"""
Scraper for soy sauce products across selected Dutch Asian shops and supermarkets.
Outputs: scraper/output/kikkoman_prices_<timestamp>.csv

Detection strategy per shop:
  1. direct_urls         — Shopify shops: fetch specific product handles via .json API
  2. direct_product_urls — HTML shops: fetch specific product page URLs directly
  3. ah_api              — Albert Heijn: anonymous token + mobile-services search API
  4. Shopify JSON API    — search suggest endpoint, then products.json
  5. HTML search page    — common search URL patterns + schema.org / JSON-LD

Soy sauce category pages (for manual reference / future updates):
  Shilla Market   : https://shillamarket.com/collections/soy-sauce
  Dun Yong        : https://dunyong.com/collections/soy-sauce
  Tjin's Toko     : https://www.tjinstoko.eu/nl/zoeken-per-land/japan/sojasaus-japan/
  Albert Heijn    : https://www.ah.nl/producten/6409/soepen-sauzen-kruiden-olie?Soort=4421
  Jumbo           : https://www.jumbo.com/producten/wereldkeukens,-kruiden,-pasta-en-rijst/aziatische-keuken/bijgerechten-en-sauzen/ketjap-en-sojasaus/
  ACE Market      : https://acemarket.nl/categorie/sauzen/sauzen-dressings/sojasaus/
  Toko Gembira    : https://www.tokogembira.nl/nl/producten/sauzen/ketjap-sojasaus-3276154/
  Toko Asia       : https://www.tokoazia.nl/Sojasaus
  PLUS            : https://www.plus.nl/zoekresultaten?SearchTerm=soja%20saus (JS-only, not scraped)
  Sligro          : https://www.sligro.nl/c.230.html/.../ketjap-sojasauzen.html (B2B login required, not scraped)
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
    {"shop_name": "Tjin's Toko", "website": "https://www.tjinstoko.eu", "direct_product_urls": [
        # Kikkoman
        "https://www.tjinstoko.eu/en/kikkoman-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-soy-sauce-250ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-soy-sauce-1l.html",
        "https://www.tjinstoko.eu/en/kikkoman-soy-sauce-less-salt-250ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-soy-sauce-less-salt-975ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-less-salt-schenkfles-150ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-tamari-soy-sauce-250ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-tamari-sojasaus-150ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-tamari-1l.html",
        "https://www.tjinstoko.eu/en/kikkoman-ponzu-soy-sauce-1l.html",
        "https://www.tjinstoko.eu/en/kikkoman-ponzu-citrus-soy-sauce-250ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-sushi-sashimi-soy-sauce-250ml.html",
        "https://www.tjinstoko.eu/en/kikkoman-tokusen-marudaizu-shoyu-1l.html",
        "https://www.tjinstoko.eu/en/nama-unpasteurized-soy-sauce-200ml.html",
        # Yamasa
        "https://www.tjinstoko.eu/en/yamasa-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/yamasa-soy-sauce-500ml.html",
        "https://www.tjinstoko.eu/en/yamasa-soy-sauce-1l.html",
        # Lee Kum Kee
        "https://www.tjinstoko.eu/en/lee-kum-kee-premium-light-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/lee-kum-kee-premium-light-soy-sauce-500ml.html",
        "https://www.tjinstoko.eu/en/lee-kum-kee-premium-dark-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/lee-kum-kee-premium-dark-soy-sauce-500ml.html",
        "https://www.tjinstoko.eu/en/lee-kum-kee-double-deluxe-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/lee-kum-kee-double-deluxe-soy-sauce-500ml.html",
        "https://www.tjinstoko.eu/en/lee-kum-kee-seasoned-soy-sauce-for-seafood-410ml.html",
        # Pearl River Bridge
        "https://www.tjinstoko.eu/en/pearl-river-bridge-light-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/pearl-river-bridge-light-soy-sauce-500ml.html",
        "https://www.tjinstoko.eu/en/pearl-river-bridge-dark-soy-sauce-150ml.html",
        "https://www.tjinstoko.eu/en/pearl-river-bridge-dark-soy-sauce-500ml.html",
        "https://www.tjinstoko.eu/en/pearl-river-bridge-soy-sauce-gold-label-500ml.html",
        "https://www.tjinstoko.eu/en/pearl-river-bridge-mushroom-soy-150ml.html",
        "https://www.tjinstoko.eu/en/pearl-river-bridge-mushroom-soy-500ml.html",
        # Sempio
        "https://www.tjinstoko.eu/en/sempio-soy-sauce-rich-mellow-jin-s-500ml.html",
        "https://www.tjinstoko.eu/en/sempio-soy-sauce-naturally-brewed-501-500ml.html",
        # Mee Chun
        "https://www.tjinstoko.eu/en/mee-chun-best-soy-sauce-250ml.html",
        "https://www.tjinstoko.eu/en/mee-chun-best-soy-sauce-500ml.html",
        # Healthy Boy
        "https://www.tjinstoko.eu/en/healthy-boy-thin-soy-sauce-700ml.html",
        "https://www.tjinstoko.eu/en/healthy-boy-black-soy-sauce-700ml.html",
        "https://www.tjinstoko.eu/en/healthy-boy-mushroom-soy-700ml.html",
        # Silver Swan
        "https://www.tjinstoko.eu/en/silver-swan-soy-sauce-1l.html",
        # Dek Som Boon
        "https://www.tjinstoko.eu/en/dek-som-boon-thin-soy-sauce-300ml.html",
        "https://www.tjinstoko.eu/en/dek-som-boon-mushroom-soy-sauce-300ml.html",
        # ABC
        "https://www.tjinstoko.eu/en/abc-kecap-manis-275ml.html",
        "https://www.tjinstoko.eu/en/abc-kecap-manis-600ml.html",
    ]},
    {"shop_name": "Toko Dua Saudara",   "website": "https://toko-dua-saudara.nl"},
    {"shop_name": "Toko Asia", "website": "https://www.tokoazia.nl", "direct_product_urls": [
        # Kikkoman
        "https://www.tokoazia.nl/Kikkoman-Soy-Sauce-1-Liter",
        "https://www.tokoazia.nl/Kikkoman-Soy-Sauce-500-ml",
        "https://www.tokoazia.nl/Kikkoman-Soy-Sauce-250-ml",
        "https://www.tokoazia.nl/Kikkoman-Soja-Sauce-150-ml",
        "https://www.tokoazia.nl/Kikkoman-Less-Salt-Soy-Sauce-1-Liter",
        "https://www.tokoazia.nl/Kikkoman-Less-Salt-Soy-Sauce-150-ml",
        "https://www.tokoazia.nl/Kikkoman-Tamari-Soy-Sauce-250-ml",
        "https://www.tokoazia.nl/KIKKOMAN-SOY-SAUCE-GLUTEN-FREE-TAMARI-1LITER",
        "https://www.tokoazia.nl/KIKKOMAN-GLUTEN-FREE-SOJASAUS-TAMARI-150ML",
        "https://www.tokoazia.nl/KIKKOMAN-PONZU-LEMON-SOY-SAUCE-250-ML",
        "https://www.tokoazia.nl/KZ-Soy-Sauce-Sushi-Sashimi-200-ml",
        "https://www.tokoazia.nl/KIKKOMAN-BIO-SOJASAUCE-150-ML",
        # Yamasa
        "https://www.tokoazia.nl/YAMASA-SOJASAUS-FANCY-1LITER",
        # Lee Kum Kee
        "https://www.tokoazia.nl/LKK-Premium-Light-Soy-Sauce-500-ml",
        "https://www.tokoazia.nl/LKK-Premium-Dark-Soy-Sauce-500-ml",
        # Pearl River Bridge
        "https://www.tokoazia.nl/Golden-Label-Lichte-Sojasaus",
        # Sempio
        "https://www.tokoazia.nl/SEMPIO-SOY-SAUCE-SALT-PET-500ML",
        # Mee Chun
        "https://www.tokoazia.nl/Mee-Chun-Best-Soy-Sauce-250-ml",
        "https://www.tokoazia.nl/Mee-Chun-Best-Soy-Sauce-500-ml",
        # Healthy Boy
        "https://www.tokoazia.nl/HEALTHY-BOY-THIN-SOY-SAUCE-700ML",
        "https://www.tokoazia.nl/HB-Black-Soy-Sauce-700-ml",
        "https://www.tokoazia.nl/HB-Mushroom-Soy-Sauce-700-ml",
        "https://www.tokoazia.nl/HB-Thin-Soy-Sauce-300-ml",
        "https://www.tokoazia.nl/HB-Soy-Sauce-Mushroom-300-ml",
    ]},
    {"shop_name": "Toko Gembira", "website": "https://www.tokogembira.nl", "direct_product_urls": [
        # Kikkoman
        "https://www.tokogembira.nl/nl/kikkoman-sojasaus-500-ml.html",
        "https://www.tokogembira.nl/nl/kikkoman-sojasaus-1-l.html",
        "https://www.tokogembira.nl/nl/kikkoman-soja-saus-1-liter.html",
        "https://www.tokogembira.nl/nl/kikkoman-soja-saus-250ml.html",
        "https://www.tokogembira.nl/nl/soy-sauce-150ml-less-salt.html",
        "https://www.tokogembira.nl/nl/tamari-gluten-free-soy-sauce-150ml-kikkoman.html",
        # Yamasa
        "https://www.tokogembira.nl/nl/yamasa-soy-sauce-1-liter.html",
        # Pearl River Bridge
        "https://www.tokogembira.nl/nl/golden-label-sojasaus500ml.html",
        "https://www.tokogembira.nl/nl/light-soja-saus-150-ml.html",
        "https://www.tokogembira.nl/nl/mushroom-dark-soy-sauce-150ml-pearl-river-bridge.html",
        "https://www.tokogembira.nl/nl/superieure-donkere-sojasaus-500ml.html",
        # Lee Kum Kee
        "https://www.tokogembira.nl/nl/gyoza-sauce-150ml-lee-kum-kee.html",
        "https://www.tokogembira.nl/nl/shallot-seasoned-soy-sauce-207ml-lee-kum-kee.html",
        "https://www.tokogembira.nl/nl/sweet-soy-sauce-for-dim-sum-rice-207ml-lee-kum-kee.html",
        # Mee Chun
        "https://www.tokogembira.nl/nl/soy-sauce-250ml-mee-chun.html",
        "https://www.tokogembira.nl/nl/sojasaus-mee-chun-250-ml.html",
        "https://www.tokogembira.nl/nl/spiced-mushroom-soy-sauce-500ml-mee-chun.html",
        # Healthy Boy
        "https://www.tokogembira.nl/nl/healthy-boy-brand-thin-soy-sauce-700ml.html",
        "https://www.tokogembira.nl/nl/healthy-boy-brand-soy-sauce-with-mushroom-700ml.html",
        "https://www.tokogembira.nl/nl/healthy-boy-brand-naturally-fermented-soy-sauce-10.html",
        # Silver Swan
        "https://www.tokogembira.nl/nl/silver-swan-soy-sauce-1l.html",
        "https://www.tokogembira.nl/nl/silver-swan-soy-sauce-385ml.html",
        # ABC
        "https://www.tokogembira.nl/nl/abc-kecap-manis-600ml.html",
        "https://www.tokogembira.nl/nl/abc-kecap-manis-zoet-275ml.html",
        # Dek Som Boon
        "https://www.tokogembira.nl/nl/black-soy-sauce-formule-2-700ml-desk-som-boon-yell.html",
        "https://www.tokogembira.nl/nl/sweet-soy-sauce-970g-dek-som-boon.html",
    ]},
    {"shop_name": "ACE Market", "website": "https://acemarket.nl", "direct_product_urls": [
        "https://acemarket.nl/product/kikkoman-soy-sauce-dispenser-150ml/",
        "https://acemarket.nl/product/kikkoman-soy-sauce-japanese-500ml/",
        "https://acemarket.nl/product/kikkoman-soy-sauce-nl-1l/",
        "https://acemarket.nl/product/kikkoman-less-salt-soy-sauce-large-975ml/",
        "https://acemarket.nl/product/kikkoman-ponzu-soy-sauce-250ml/",
        "https://acemarket.nl/product/kikkoman-tamari-gluten-free-soya-sauce-1l/",
        "https://acemarket.nl/product/pearl-river-bridge-light-soy-sauce-large-500ml/",
        "https://acemarket.nl/product/lee-kum-kee-premium-dark-soy-sauce-medium-500ml/",
        "https://acemarket.nl/product/lee-kum-kee-premium-light-soy-sauce-small-150ml/",
        "https://acemarket.nl/product/mee-chun-soy-sauce-500ml/",
        "https://acemarket.nl/product/sempio-soy-sauce-jin-s-500ml/",
        "https://acemarket.nl/product/abc-sweet-soy-sauce-large-600ml/",
        "https://acemarket.nl/product/abc-sweet-soy-sauce-kecap-manis-275ml/",
        "https://acemarket.nl/product/dek-som-boon-salt-reduced-soy-sauce-250ml/",
        "https://acemarket.nl/product/shibanuma-gluten-free-soy-sauce-1l/",
        "https://acemarket.nl/product/shibanuma-soy-sauce-300ml/",
    ]},
    # Dutch supermarkets
    {"shop_name": "Albert Heijn", "website": "https://www.ah.nl", "strategy": "ah_api"},
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
# Direct HTML product page strategy (non-Shopify shops)
# ---------------------------------------------------------------------------

def _extract_price_from_page(shop_name, title, product_url, page_image_url, soup, scrape_run_id, scraped_at) -> Optional[PriceRecord]:
    """Extract price from a product page using meta itemprop, JSON-LD, or WooCommerce HTML."""
    meta = soup.find("meta", {"itemprop": "price"})
    if meta and meta.get("content"):
        return _make_record(shop_name, title, f"€{float(meta['content']):.2f}", "EUR", product_url, page_image_url, scrape_run_id, scraped_at)

    # WooCommerce: <span class="woocommerce-Price-amount amount">
    woo = soup.find("span", class_="woocommerce-Price-amount")
    if woo:
        raw = woo.get_text(strip=True).replace("€", "").replace("\xa0", "").replace(",", ".").strip()
        try:
            return _make_record(shop_name, title, f"€{float(raw):.2f}", "EUR", product_url, page_image_url, scrape_run_id, scraped_at)
        except ValueError:
            pass

    # Toko Asia (CS-Cart): <span id="Price1_inc">€ 9,98</span>
    price_span = soup.find("span", {"id": "Price1_inc"})
    if price_span:
        raw = price_span.get_text(strip=True).replace("€", "").replace("\xa0", "").replace(",", ".").strip()
        try:
            price_val = float(raw)
            if price_val > 0:
                return _make_record(shop_name, title, f"€{price_val:.2f}", "EUR", product_url, page_image_url, scrape_run_id, scraped_at)
        except ValueError:
            pass

    # Webshopapp (Toko Gembira etc.): <span class="item-price">€5,49</span>
    # Multiple spans may exist (cart widget has empty ones) — find first non-zero
    for item_price in soup.find_all("span", class_="item-price"):
        raw = item_price.get_text(strip=True).replace("€", "").replace("\xa0", "").replace(",", ".").strip()
        try:
            price_val = float(raw)
            if price_val > 0:
                return _make_record(shop_name, title, f"€{price_val:.2f}", "EUR", product_url, page_image_url, scrape_run_id, scraped_at)
        except ValueError:
            continue

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
                        ld_image = item.get("image", "")
                        if isinstance(ld_image, list):
                            ld_image = ld_image[0]
                        if isinstance(ld_image, dict):
                            ld_image = ld_image.get("url") or ld_image.get("contentUrl", "")
                        return _make_record(
                            shop_name, item.get("name", title),
                            f"€{float(price):.2f}",
                            offer.get("priceCurrency", "EUR"),
                            product_url, ld_image or page_image_url,
                            scrape_run_id, scraped_at,
                        )
        except (json.JSONDecodeError, AttributeError):
            continue
    return None


def _scrape_html_product_pages(shop_name: str, urls: list[str], scrape_run_id: str, scraped_at: str) -> list[PriceRecord]:
    """Fetch specific HTML product pages and extract price + image."""
    records = []
    for product_url in urls:
        r = _get(product_url)
        if not r:
            log.warning("  Could not fetch %s", product_url)
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        h1 = soup.find("h1")
        title = h1.get_text(strip=True) if h1 else product_url
        og_image = soup.find("meta", {"property": "og:image"})
        page_image_url = og_image.get("content", "") if og_image else ""
        # Fallback: first product image hosted on the same domain (skip SVG placeholders)
        if not page_image_url:
            domain = product_url.split("/")[2]  # e.g. "acemarket.nl"
            for img in soup.find_all("img", src=True):
                src = img.get("src", "")
                if src and domain in src and any(src.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
                    page_image_url = src
                    break
        record = _extract_price_from_page(shop_name, title, product_url, page_image_url, soup, scrape_run_id, scraped_at)
        if record:
            records.append(record)
            log.info("  ✓ %s — %s", record.product_name, record.raw_price)
        else:
            log.warning("  Could not extract price for %s", product_url)
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
# Albert Heijn API strategy
# ---------------------------------------------------------------------------

SOY_SAUCE_KEYWORDS = ["shoyu", "soy sauce", "sojasaus"]

def _is_soy_sauce(title: str) -> bool:
    t = title.lower()
    return any(k in t for k in SOY_SAUCE_KEYWORDS)


def _try_ah_api(shop_name: str, scrape_run_id: str, scraped_at: str) -> list[PriceRecord]:
    """Use AH anonymous mobile API to search for all soy sauce products."""
    # Step 1: get anonymous token
    try:
        r = requests.post(
            "https://api.ah.nl/mobile-auth/v1/auth/token/anonymous",
            json={"clientId": "appie"},
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        token = r.json().get("access_token", "")
    except Exception as e:
        log.warning("AH: could not get token: %s", e)
        return []

    if not token:
        log.warning("AH: no access_token in response")
        return []

    auth_headers = {**HEADERS, "Authorization": f"Bearer {token}"}

    # Step 2: search for each keyword to catch Dutch and English names
    seen_titles: set[str] = set()
    records: list[PriceRecord] = []

    for query in ["sojasaus", "shoyu", "soy sauce"]:
        try:
            r = requests.get(
                "https://api.ah.nl/mobile-services/product/search/v2",
                params={"query": query, "size": 50},
                headers=auth_headers,
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            log.debug("AH search '%s' failed: %s", query, e)
            continue

        # Response can be cards[].products[] or a flat products[] list
        products = []
        for card in data.get("cards", []):
            products.extend(card.get("products", []))
        products = products or data.get("products", [])

        for product in products:
            title = product.get("title", "")
            if not _is_soy_sauce(title):
                continue
            if title in seen_titles:
                continue
            seen_titles.add(title)

            price_info = product.get("price", {})
            price_now = price_info.get("now", "")
            raw_price = f"€{float(price_now):.2f}" if price_now != "" else ""

            images = product.get("images", [])
            image_url = images[0].get("url", "") if images else ""

            link = product.get("link", "")
            product_url = f"https://www.ah.nl{link}" if link else ""

            records.append(_make_record(
                shop_name, title, raw_price, "EUR",
                product_url, image_url, scrape_run_id, scraped_at,
            ))
            log.info("  ✓ %s — %s", title, raw_price)

    return records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def scrape_shop(shop: dict, scrape_run_id: str, scraped_at: str) -> list[PriceRecord]:
    shop_name = shop["shop_name"]
    base_url  = shop["website"].rstrip("/")

    # Shopify shops: fetch specific product handles via .json API
    if shop.get("direct_urls"):
        return _try_direct_urls(shop_name, base_url, shop["direct_urls"], scrape_run_id, scraped_at)

    # HTML shops: fetch specific product page URLs directly
    if shop.get("direct_product_urls"):
        return _scrape_html_product_pages(shop_name, shop["direct_product_urls"], scrape_run_id, scraped_at)

    # Albert Heijn: anonymous token + mobile-services search API
    if shop.get("strategy") == "ah_api":
        return _try_ah_api(shop_name, scrape_run_id, scraped_at)

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
