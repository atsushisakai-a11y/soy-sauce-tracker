"""
Scraper for Kikkoman Koikuchi Shoyu 500ml across Amsterdam Asian shops.
Shop list is pulled dynamically from Snowflake staging.staging_shops.
Outputs: scraper/output/kikkoman_prices_<timestamp>.csv

Detection strategy per shop:
  1. Shopify JSON API  (/products.json — search by title)
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

# Keywords used to match Kikkoman Koikuchi Shoyu 500ml in product titles
KIKKOMAN_KEYWORDS = ["kikkoman"]
SHOYU_KEYWORDS    = ["shoyu", "soy sauce", "sojasaus", "ketjap", "koikuchi"]
SIZE_KEYWORDS     = ["500"]


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
    rows = [{"shop_name": r[0], "website": r[1].rstrip("/")} for r in cur.fetchall()]
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


def _is_kikkoman_500(title: str) -> bool:
    t = title.lower()
    return (
        any(k in t for k in KIKKOMAN_KEYWORDS)
        and any(k in t for k in SHOYU_KEYWORDS)
        and any(k in t for k in SIZE_KEYWORDS)
    )


# ---------------------------------------------------------------------------
# Shopify strategy
# ---------------------------------------------------------------------------

def _try_shopify(shop_name: str, base_url: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    """Search Shopify /products.json for Kikkoman 500ml."""
    url = f"{base_url}/products.json?limit=250"
    r = _get(url)
    if not r:
        return None
    try:
        products = r.json().get("products", [])
    except Exception:
        return None
    if not products:
        return None  # not a Shopify store or empty catalogue

    for product in products:
        title = product.get("title", "")
        if not _is_kikkoman_500(title):
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

_SEARCH_PATTERNS = [
    "{base}/search?type=product&q=kikkoman+shoyu+500",
    "{base}/search?q=kikkoman+shoyu+500",
    "{base}/zoeken?q=kikkoman",       # Dutch
    "{base}/search?q=kikkoman",
]


def _try_html_search(shop_name: str, base_url: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    """Try common search URLs and parse the first matching product result."""
    for pattern in _SEARCH_PATTERNS:
        url = pattern.format(base=base_url)
        r = _get(url)
        if not r:
            continue

        soup = BeautifulSoup(r.text, "html.parser")

        # Look for product links whose anchor text matches Kikkoman 500ml
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            if not _is_kikkoman_500(text):
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
# Main
# ---------------------------------------------------------------------------

def scrape_shop(shop_name: str, website: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    record = _try_shopify(shop_name, website, scrape_run_id, scraped_at)
    if record:
        return record
    return _try_html_search(shop_name, website, scrape_run_id, scraped_at)


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
        record = scrape_shop(shop_name, website, scrape_run_id, scraped_at)
        if record:
            records.append(record)
            log.info("  ✓ %s — %s", shop_name, record.raw_price)
        else:
            log.info("  – %s — Kikkoman 500ml not found", shop_name)
        time.sleep(1)

    log.info("Found prices in %d / %d shops", len(records), len(shops))
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
