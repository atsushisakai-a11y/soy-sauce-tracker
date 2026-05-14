"""
Scraper for Kikkoman soy sauce products across Amsterdam Asian shops.
Shop list is pulled dynamically from Snowflake staging.staging_shops.
Outputs: scraper/output/kikkoman_prices_<timestamp>.csv

Target products:
  - Kikkoman Koikuchi Shoyu 500ml
  - Kikkoman Sojasaus 150ml

Detection strategy per shop:
  1. Shopify JSON API  (search suggest endpoint, then products.json)
  2. HTML search page  (common search URL patterns)
"""

import csv
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, fields
from datetime import datetime, timezone
from typing import Optional

import requests
import snowflake.connector
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
}
TIMEOUT = 15

# Target product sizes to search for per shop
TARGET_SIZES = ["500", "150"]

KIKKOMAN_KEYWORDS = ["kikkoman"]
SHOYU_KEYWORDS    = ["shoyu", "soy sauce", "sojasaus", "ketjap", "koikuchi"]


@dataclass
class PriceRecord:
    scrape_run_id: str
    shop_name: str
    product_name: str
    raw_price: str
    currency: str
    product_url: str
    scraped_at: str


# ---------------------------------------------------------------------------
# Snowflake
# ---------------------------------------------------------------------------

def get_shops_from_snowflake() -> list[dict]:
    """Return list of {shop_name, website} from staging.staging_shops."""
    conn = snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.environ.get("SNOWFLAKE_ROLE", ""),
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database="price_monitoring",
        schema="STAGING",
    )
    cur = conn.cursor()
    cur.execute("SELECT shop_name, website FROM staging_shops WHERE website IS NOT NULL")
    rows = []
    seen_urls = set()
    for r in cur.fetchall():
        parsed = urlparse(r[1])
        base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        if base not in seen_urls:
            seen_urls.add(base)
            rows.append({"shop_name": r[0], "website": base})

    cur.close()
    conn.close()
    log.info("Loaded %d shops from Snowflake staging_shops", len(rows))
    return rows


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(url: str) -> Optional[requests.Response]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        return r
    except requests.RequestException as e:
        log.debug("GET %s failed: %s", url, e)
        return None


def _is_kikkoman_target(title: str, size: str) -> bool:
    t = title.lower()
    return (
        any(k in t for k in KIKKOMAN_KEYWORDS)
        and any(k in t for k in SHOYU_KEYWORDS)
        and size in t
    )


# ---------------------------------------------------------------------------
# Shopify strategy
# ---------------------------------------------------------------------------

def _try_shopify(shop_name: str, base_url: str, size: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    """Search Shopify store for a Kikkoman product of the given size."""
    # Strategy 1: Shopify search API (works even with large catalogues)
    for q in [f"kikkoman {size}ml", f"kikkoman shoyu {size}", "kikkoman"]:
        url = f"{base_url}/search/suggest.json?q={q.replace(' ', '+')}&resources[type]=product&resources[limit]=10"
        r = _get(url)
        if not r:
            break
        try:
            results = r.json().get("resources", {}).get("results", {}).get("products", [])
        except Exception:
            break
        for product in results:
            title = product.get("title", "")
            if not _is_kikkoman_target(title, size):
                continue
            price = product.get("price", "")
            product_url = product.get("url", "")
            if product_url and not product_url.startswith("http"):
                product_url = base_url + product_url
            return PriceRecord(
                scrape_run_id=scrape_run_id,
                shop_name=shop_name,
                product_name=title,
                raw_price=f"€{price}" if price else "",
                currency="EUR",
                product_url=product_url,
                scraped_at=scraped_at,
            )

    # Strategy 2: products.json (first page — confirms it's Shopify)
    url = f"{base_url}/products.json?limit=250"
    r = _get(url)
    if not r:
        return None
    try:
        products = r.json().get("products", [])
    except Exception:
        return None
    if not products:
        return None  # not a Shopify store

    for product in products:
        title = product.get("title", "")
        if not _is_kikkoman_target(title, size):
            continue
        variants = product.get("variants", [])
        if not variants:
            continue
        price = variants[0].get("price", "")
        handle = product.get("handle", "")
        product_url = f"{base_url}/products/{handle}"
        return PriceRecord(
            scrape_run_id=scrape_run_id,
            shop_name=shop_name,
            product_name=title,
            raw_price=f"€{price}",
            currency="EUR",
            product_url=product_url,
            scraped_at=scraped_at,
        )
    return None


# ---------------------------------------------------------------------------
# HTML search strategy
# ---------------------------------------------------------------------------

def _search_patterns(size: str) -> list[str]:
    return [
        f"{{base}}/search?type=product&q=kikkoman+{size}ml",
        f"{{base}}/search?q=kikkoman+{size}ml",
        "{base}/zoeken?q=kikkoman",
        "{base}/search?q=kikkoman",
    ]


def _try_html_search(shop_name: str, base_url: str, size: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    """Try common search URLs and parse the first matching product result."""
    for pattern in _search_patterns(size):
        url = pattern.format(base=base_url)
        r = _get(url)
        if not r:
            continue

        soup = BeautifulSoup(r.text, "html.parser")

        # Look for product links whose anchor text matches the target product
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            if not _is_kikkoman_target(text, size):
                continue

            product_url = a["href"]
            if not product_url.startswith("http"):
                product_url = base_url + product_url

            # Fetch the product page and extract price
            pr = _get(product_url)
            if not pr:
                continue
            prod_soup = BeautifulSoup(pr.text, "html.parser")

            # schema.org meta tag
            meta = prod_soup.find("meta", {"itemprop": "price"})
            if meta and meta.get("content"):
                return PriceRecord(
                    scrape_run_id=scrape_run_id,
                    shop_name=shop_name,
                    product_name=text,
                    raw_price=f"€{float(meta['content']):.2f}",
                    currency="EUR",
                    product_url=product_url,
                    scraped_at=scraped_at,
                )

            # JSON-LD
            for script in prod_soup.find_all("script", {"type": "application/ld+json"}):
                try:
                    ld = json.loads(script.string or "")
                    items = ld if isinstance(ld, list) else [ld]
                    for item in items:
                        if item.get("@type") in ("Product", "Offer"):
                            offer = item.get("offers", item)
                            if isinstance(offer, list):
                                offer = offer[0]
                            price = offer.get("price") or offer.get("lowPrice")
                            if price:
                                return PriceRecord(
                                    scrape_run_id=scrape_run_id,
                                    shop_name=shop_name,
                                    product_name=item.get("name", text),
                                    raw_price=f"€{float(price):.2f}",
                                    currency=offer.get("priceCurrency", "EUR"),
                                    product_url=product_url,
                                    scraped_at=scraped_at,
                                )
                except (json.JSONDecodeError, AttributeError):
                    continue
    return None


# ---------------------------------------------------------------------------
# Hardcoded fallbacks for shops not in OSM data
# ---------------------------------------------------------------------------

HARDCODED_SHOPS = [
    {
        "shop_name": "NikanKitchen",
        "product_url": "https://www.nikankitchen.com/en/products/2611/kikkoman-shoyu-soy-sauce-500ml",
        "product_name": "Kikkoman Shoyu Soy Sauce 500ml",
    },
    {
        "shop_name": "Oriental Webshop",
        "product_url": "https://www.orientalwebshop.nl/nl/kikkoman-soy-sauce-150ml",
        "product_name": "Kikkoman Soy Sauce 150ml",
    },
]


def _scrape_hardcoded(shop: dict, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    r = _get(shop["product_url"])
    if not r:
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    meta = soup.find("meta", {"itemprop": "price"})
    if meta and meta.get("content"):
        return PriceRecord(
            scrape_run_id=scrape_run_id,
            shop_name=shop["shop_name"],
            product_name=shop["product_name"],
            raw_price=f"€{float(meta['content']):.2f}",
            currency="EUR",
            product_url=shop["product_url"],
            scraped_at=scraped_at,
        )
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def scrape_shop(shop_name: str, website: str, scrape_run_id: str, scraped_at: str) -> list[PriceRecord]:
    """Return one record per target size found in this shop."""
    found = []
    for size in TARGET_SIZES:
        record = _try_shopify(shop_name, website, size, scrape_run_id, scraped_at)
        if not record:
            record = _try_html_search(shop_name, website, size, scrape_run_id, scraped_at)
        if record:
            found.append(record)
    return found


def run() -> list[PriceRecord]:
    scrape_run_id = str(uuid.uuid4())
    scraped_at = datetime.now(timezone.utc).isoformat()

    log.info("Run ID : %s", scrape_run_id)
    log.info("Run time: %s", scraped_at)

    shops = get_shops_from_snowflake()
    records: list[PriceRecord] = []

    for shop in shops:
        shop_name = shop["shop_name"]
        website   = shop["website"]
        log.info("Scraping %s (%s) …", shop_name, website)
        found = scrape_shop(shop_name, website, scrape_run_id, scraped_at)
        if found:
            for r in found:
                records.append(r)
                log.info("  ✓ %s — %s — %s", shop_name, r.product_name, r.raw_price)
        else:
            log.info("  – %s — no Kikkoman products found", shop_name)
        time.sleep(1)

    log.info("Found %d price records from %d Snowflake shops", len(records), len(shops))

    # Hardcoded shops not in OSM data
    for shop in HARDCODED_SHOPS:
        log.info("Scraping %s (hardcoded) …", shop["shop_name"])
        record = _scrape_hardcoded(shop, scrape_run_id, scraped_at)
        if record:
            records.append(record)
            log.info("  ✓ %s — %s — %s", shop["shop_name"], record.product_name, record.raw_price)
        else:
            log.info("  – %s — price not found", shop["shop_name"])
        time.sleep(1)

    return records


def save_csv(records: list[PriceRecord]) -> str:
    os.makedirs("output", exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = f"output/kikkoman_prices_{ts}.csv"
    col_names = [f.name for f in fields(PriceRecord)]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=col_names)
        writer.writeheader()
        for r in records:
            writer.writerow({f.name: getattr(r, f.name) for f in fields(PriceRecord)})
    log.info("Saved %d records → %s", len(records), path)
    return path


if __name__ == "__main__":
    results = run()
    if results:
        save_csv(results)
    else:
        log.warning("No Kikkoman 500ml prices found across all shops.")
