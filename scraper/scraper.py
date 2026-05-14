"""
Scraper for Kikkoman Koikuchi Shoyu 500ml across Dutch/Asian online shops.
Outputs: scraper/output/kikkoman_prices_<timestamp>.csv

Shops:
  - Shilla Market   (Shopify JSON API)
  - Dun Yong        (Shopify JSON API)
  - NikanKitchen    (HTML / schema.org)
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


@dataclass
class PriceRecord:
    scrape_run_id: str        # unique ID per workflow run — all shops in one run share this
    shop_name: str
    product_name: str
    raw_price: str            # exactly as shown on site, e.g. "€5.65"
    currency: str
    product_url: str
    scraped_at: str           # ISO-8601 UTC — set once at run start, same for all shops


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(url: str) -> Optional[requests.Response]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        return r
    except requests.RequestException as e:
        log.error("GET %s failed: %s", url, e)
        return None


def _shopify_price(
    shop_name: str,
    product_url: str,
    json_url: str,
    scrape_run_id: str,
    scraped_at: str,
) -> Optional[PriceRecord]:
    """Extract price from a Shopify product JSON endpoint."""
    r = _get(json_url)
    if not r:
        return None
    data = r.json()
    product = data.get("product", {})
    variants = product.get("variants", [])
    if not variants:
        log.error("%s: no variants found in JSON", shop_name)
        return None

    price_str = variants[0].get("price", "")  # e.g. "5.65"
    title = product.get("title", "Unknown")
    currency = data.get("currency", "EUR")

    return PriceRecord(
        scrape_run_id=scrape_run_id,
        shop_name=shop_name,
        product_name=title,
        raw_price=f"€{price_str}",
        currency=currency,
        product_url=product_url,
        scraped_at=scraped_at,
    )


def _html_price(
    shop_name: str,
    product_url: str,
    product_name_override: str,
    price_selectors: list[tuple[str, dict]],
    scrape_run_id: str,
    scraped_at: str,
) -> Optional[PriceRecord]:
    """Extract price from HTML using schema.org or CSS selectors."""
    r = _get(product_url)
    if not r:
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    # 1. Try schema.org meta tag first (most reliable)
    meta_price = soup.find("meta", {"itemprop": "price"})
    if meta_price and meta_price.get("content"):
        return PriceRecord(
            scrape_run_id=scrape_run_id,
            shop_name=shop_name,
            product_name=product_name_override,
            raw_price=f"€{float(meta_price['content']):.2f}",
            currency="EUR",
            product_url=product_url,
            scraped_at=scraped_at,
        )

    # 2. Try JSON-LD
    for script in soup.find_all("script", {"type": "application/ld+json"}):
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
                            product_name=item.get("name", product_name_override),
                            raw_price=f"€{float(price):.2f}",
                            currency=offer.get("priceCurrency", "EUR"),
                            product_url=product_url,
                            scraped_at=scraped_at,
                        )
        except (json.JSONDecodeError, AttributeError):
            continue

    # 3. Fallback: CSS selectors provided per shop
    for selector, attrs in price_selectors:
        el = soup.find(selector, attrs) if attrs else soup.select_one(selector)
        if el:
            text = el.get_text(strip=True)
            price_text = re.sub(r"[^\d,\.€]", "", text)
            if price_text:
                return PriceRecord(
                    scrape_run_id=scrape_run_id,
                    shop_name=shop_name,
                    product_name=product_name_override,
                    raw_price=price_text,
                    currency="EUR",
                    product_url=product_url,
                    scraped_at=scraped_at,
                )

    log.error("%s: could not find price on %s", shop_name, product_url)
    return None


# ---------------------------------------------------------------------------
# Per-shop scrapers
# ---------------------------------------------------------------------------

def scrape_shilla(scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    return _shopify_price(
        shop_name="Shilla Market",
        product_url="https://shillamarket.com/nl/products/kikkoman-koikuchi-shoyu-500ml",
        json_url="https://shillamarket.com/nl/products/kikkoman-koikuchi-shoyu-500ml.json",
        scrape_run_id=scrape_run_id,
        scraped_at=scraped_at,
    )


def scrape_dunyong(scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    return _shopify_price(
        shop_name="Dun Yong",
        product_url="https://dunyong.com/products/naturally-brewed-soy-sauce-kikkoman-500ml",
        json_url="https://dunyong.com/products/naturally-brewed-soy-sauce-kikkoman-500ml.json",
        scrape_run_id=scrape_run_id,
        scraped_at=scraped_at,
    )


def scrape_nikankitchen(scrape_run_id: str, scraped_at: str) -> Optional[PriceRecord]:
    return _html_price(
        shop_name="NikanKitchen",
        product_url="https://www.nikankitchen.com/en/products/2611/kikkoman-shoyu-soy-sauce-500ml",
        product_name_override="Kikkoman Shoyu Soy Sauce 500ml",
        price_selectors=[
            ("span", {"class": re.compile(r"price", re.I)}),
            (".price", {}),
            ("[data-price]", {}),
        ],
        scrape_run_id=scrape_run_id,
        scraped_at=scraped_at,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

SCRAPERS = [scrape_shilla, scrape_dunyong, scrape_nikankitchen]


def run() -> list[PriceRecord]:
    # One run ID and one timestamp shared by all shops in this run
    scrape_run_id = str(uuid.uuid4())
    scraped_at = datetime.now(timezone.utc).isoformat()

    log.info("Run ID : %s", scrape_run_id)
    log.info("Run time: %s", scraped_at)

    records: list[PriceRecord] = []
    for scraper in SCRAPERS:
        log.info("Scraping %s …", scraper.__name__.replace("scrape_", ""))
        record = scraper(scrape_run_id=scrape_run_id, scraped_at=scraped_at)
        if record:
            records.append(record)
            log.info("  ✓ %s — %s", record.shop_name, record.raw_price)
        else:
            log.warning("  ✗ %s — skipped", scraper.__name__)
        time.sleep(1)  # polite delay between requests
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
        log.error("No records scraped — check shop pages for changes.")
