"""
Scraper for Kikkoman soy sauce products across selected Amsterdam Asian shops.
Outputs: scraper/output/kikkoman_prices_<timestamp>.csv

Detection strategy per shop:
  1. direct_urls (optional) — fetch specific Shopify product handles directly
  2. Shopify JSON API        — search suggest endpoint, then products.json
  3. HTML search page        — common search URL patterns + schema.org / JSON-LD
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
from bs4 import BeautifulSoup

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

TARGET_SIZES      = ["500", "150"]
KIKKOMAN_KEYWORDS = ["kikkoman"]
SHOYU_KEYWORDS    = ["shoyu", "soy sauce", "sojasaus", "koikuchi"]

SHOPS = [
    # Asian specialty shops
    {"shop_name": "NikanKitchen",       "website": "https://www.nikankitchen.com"},
    {"shop_name": "Shilla Market", "website": "https://shillamarket.com", "direct_urls": [
        "/products/kikkoman-koikuchi-shoyu-500ml",
        "/products/kikkoman-shoyu-table-dispenser-150ml",
        "/products/koikuchi-shoyu-1l",
        "/products/kikkoman-sweet-soy-sauce-250ml",
        "/products/kikkoman-nama-soy-sauce-200ml",
        "/products/kikkoman-tamari-shoyu-250ml",
        "/products/kikkoman-genen-shoyu-table-dispenser-150ml",
        "/products/tokusen-yuki-shoyu-500ml",
        "/products/tokusen-marudaizu-shoyu-1l",
    ]},
    {"shop_name": "Oriental Webshop",   "website": "https://www.orientalwebshop.nl"},
    {"shop_name": "Dun Yong", "website": "https://dunyong.com", "direct_urls": [
        "/products/naturally-brewed-soy-sauce-kikkoman-500ml",
        "/products/shouyu-naturally-brewed-soy-sauce-kikkoman-1l",
        "/products/naturally-brewed-less-salt-soy-sauce-kikkoman-1l",
        "/products/usukuchi-shoyu-light-soy-sauce-kikkoman-1l",
        "/products/sweet-soy-sauce-for-rice-kikkoman-250ml",
        "/products/kishibori-shouyu-koikuchi-soy-sauce-takesan-720ml",
        "/products/superior-light-soy-sauce-pearl-river-bridge-500ml",
        "/products/superior-light-soy-sauce-pearl-river-bridge-150ml",
        "/products/superior-dark-soy-sauce-pearl-river-bridge-500ml",
        "/products/superior-dark-soy-sauce-pearl-river-bridge-150ml",
        "/products/naturally-brewed-soy-sauce-sempio-500ml",
        "/products/naturally-brewed-soy-sauce-yamasa-150ml",
        "/products/best-soy-sauce-mee-chun-500ml",
        "/products/low-salt-soy-sauce-marukin-1l",
        "/products/thin-soy-sauce-healthy-boy-700ml",
        "/products/soy-sauce-with-mushroom-healthy-boy-700ml",
        "/products/double-deluxe-soy-sauce-lee-kum-kee-500ml",
        "/products/seasoned-soy-sauce-for-seafood-lee-kum-kee-410ml",
        "/products/kecap-manis-special-sweet-soy-sauce-abc-600ml",
        "/products/kecap-asin-special-salty-soy-sauce-abc-600ml",
    ]},
    {"shop_name": "Amazing Oriental",   "website": "https://amazingoriental.com"},
    {"shop_name": "Wah Nam Hong",       "website": "https://www.wah-nam-hong.nl"},
    {"shop_name": "Tjin's Toko",        "website": "https://tjinstoko.eu"},
    {"shop_name": "Toko Dua Saudara",   "website": "https://toko-dua-saudara.nl"},
    # Dutch supermarkets
    {"shop_name": "Albert Heijn",       "website": "https://www.ah.nl"},
    {"shop_name": "Jumbo",              "website": "https://www.jumbo.com"},
    {"shop_name": "PLUS",               "website": "https://www.plus.nl"},
    {"shop_name": "Picnic",             "website": "https://picnic.app"},
    # Marketplace
    {"shop_name": "Bol.com",            "website": "https://www.bol.com"},
]


@dataclass
class PriceRecord:
    scrape_run_id: str
    shop_name: str
    product_name: str
    raw_price: str
    currency: str
    product_url: str
    image_url: str
    scraped_at: str


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


def _make_record(shop_name, product_name, raw_price, currency, product_url, image_url, scrape_run_id, scraped_at) -> PriceRecord:
    return PriceRecord(
        scrape_run_id=scrape_run_id,
        shop_name=shop_name,
        product_name=product_name,
        raw_price=raw_price,
        currency=currency,
        product_url=product_url,
        image_url=image_url or "",
        scraped_at=scraped_at,
    )


# ---------------------------------------------------------------------------
# Direct URL strategy (Shopify product JSON)
# ---------------------------------------------------------------------------

def _try_direct_urls(shop_name: str, base_url: str, handles: list[str], scrape_run_id: str, scraped_at: str) -> list[PriceRecord]:
    """Fetch specific Shopify products by handle using the /products/{handle}.json endpoint."""
    records = []
    for handle in handles:
        url = f"{base_url}{handle}.json"
        r = _get(url)
        if not r:
            log.warning("  Could not fetch %s", url)
            continue
        try:
            product = r.json().get("product", {})
        except Exception:
            continue
        title = product.get("title", "")
        variants = product.get("variants", [])
        if not variants:
            continue
        price = variants[0].get("price", "")
        product_url = f"{base_url}{handle}"
        images = product.get("images", [])
        image_url = images[0].get("src", "") if images else ""
        records.append(_make_record(shop_name, title, f"€{price}", "EUR", product_url, image_url, scrape_run_id, scraped_at))
        log.info("  ✓ %s — €%s", title, price)
    return records


# ---------------------------------------------------------------------------
# Shopify strategy
# ---------------------------------------------------------------------------

def _try_shopify(shop_name: str, base_url: str, size: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    # Strategy 1: search suggest API
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
            image_url = product.get("featured_image", {})
            if isinstance(image_url, dict):
                image_url = image_url.get("url", "")
            return _make_record(shop_name, title, f"€{price}" if price else "", "EUR", product_url, image_url, scrape_run_id, scraped_at)

    # Strategy 2: products.json (first 250)
    r = _get(f"{base_url}/products.json?limit=250")
    if not r:
        return None
    try:
        products = r.json().get("products", [])
    except Exception:
        return None
    if not products:
        return None

    for product in products:
        title = product.get("title", "")
        if not _is_kikkoman_target(title, size):
            continue
        variants = product.get("variants", [])
        if not variants:
            continue
        price = variants[0].get("price", "")
        product_url = f"{base_url}/products/{product.get('handle', '')}"
        images = product.get("images", [])
        image_url = images[0].get("src", "") if images else ""
        return _make_record(shop_name, title, f"€{price}", "EUR", product_url, image_url, scrape_run_id, scraped_at)

    return None


# ---------------------------------------------------------------------------
# HTML search strategy
# ---------------------------------------------------------------------------

def _try_html_search(shop_name: str, base_url: str, size: str, scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    search_urls = [
        f"{base_url}/search?type=product&q=kikkoman+{size}ml",
        f"{base_url}/search?q=kikkoman+{size}ml",
        f"{base_url}/zoeken?query=kikkoman+sojasaus+{size}ml",   # Albert Heijn
        f"{base_url}/zoeken?searchTerms=kikkoman+{size}ml",      # Jumbo
        f"{base_url}/search?q=kikkoman+sojasaus&searchType=products",  # PLUS
        f"{base_url}/nl/nl/s/?searchtext=kikkoman+sojasaus+{size}ml",  # Bol.com
        f"{base_url}/zoeken?q=kikkoman",
        f"{base_url}/search?q=kikkoman",
    ]
    for url in search_urls:
        r = _get(url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            if not _is_kikkoman_target(text, size):
                continue
            product_url = a["href"]
            if not product_url.startswith("http"):
                product_url = base_url + product_url
            pr = _get(product_url)
            if not pr:
                continue
            prod_soup = BeautifulSoup(pr.text, "html.parser")

            og_image = prod_soup.find("meta", {"property": "og:image"})
            page_image_url = og_image.get("content", "") if og_image else ""

            meta = prod_soup.find("meta", {"itemprop": "price"})
            if meta and meta.get("content"):
                return _make_record(shop_name, text, f"€{float(meta['content']):.2f}", "EUR", product_url, page_image_url, scrape_run_id, scraped_at)

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
                                ld_image = item.get("image", "")
                                if isinstance(ld_image, list):
                                    ld_image = ld_image[0]
                                if isinstance(ld_image, dict):
                                    ld_image = ld_image.get("url") or ld_image.get("contentUrl", "")
                                return _make_record(
                                    shop_name, item.get("name", text),
                                    f"€{float(price):.2f}",
                                    offer.get("priceCurrency", "EUR"),
                                    product_url, ld_image or page_image_url,
                                    scrape_run_id, scraped_at,
                                )
                except (json.JSONDecodeError, AttributeError):
                    continue
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def scrape_shop(shop: dict, scrape_run_id: str, scraped_at: str) -> list[PriceRecord]:
    shop_name = shop["shop_name"]
    base_url  = shop["website"].rstrip("/")

    # If direct_urls are configured, use them exclusively
    if shop.get("direct_urls"):
        return _try_direct_urls(shop_name, base_url, shop["direct_urls"], scrape_run_id, scraped_at)

    found = []
    for size in TARGET_SIZES:
        record = _try_shopify(shop_name, base_url, size, scrape_run_id, scraped_at)
        if not record:
            record = _try_html_search(shop_name, base_url, size, scrape_run_id, scraped_at)
        if record:
            found.append(record)
    return found


def run() -> list[PriceRecord]:
    scrape_run_id = str(uuid.uuid4())
    scraped_at    = datetime.now(timezone.utc).isoformat()

    log.info("Run ID : %s", scrape_run_id)
    log.info("Run time: %s", scraped_at)

    records: list[PriceRecord] = []

    for shop in SHOPS:
        log.info("Scraping %s …", shop["shop_name"])
        found = scrape_shop(shop, scrape_run_id, scraped_at)
        if found:
            for r in found:
                records.append(r)
                log.info("  ✓ %s — %s", r.product_name, r.raw_price)
        else:
            log.info("  – no Kikkoman products found")
        time.sleep(1)

    log.info("Total: %d price records from %d shops", len(records), len(SHOPS))
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
        log.warning("No Kikkoman prices found.")
