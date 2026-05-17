"""
Compute pairwise image similarity scores for Kikkoman products.

Flow:
  1. Read distinct products from STAGING.STAGING_PRICES
  2. For each (scrape_date, brand) group, download product images and compute
     perceptual hash (pHash) similarity for every product pair
  3. Write results to STAGING.STAGING_SIMILARITY_SCORES (incremental — skips
     scrape_dates already present in the target table)

Usage:
    pip install snowflake-connector-python python-dotenv imagehash Pillow requests
    python similarity/image_similarity.py
"""

import io
import itertools
import logging
import os
from datetime import datetime, timezone

import imagehash
import requests
import snowflake.connector
from dotenv import load_dotenv
from PIL import Image

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
TIMEOUT = 15
PHASH_BITS = 64  # default pHash produces a 64-bit hash


def get_conn():
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.environ.get("SNOWFLAKE_ROLE", ""),
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        schema="STAGING",
    )


def ensure_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS STAGING_SIMILARITY_SCORES (
            SCRAPE_DATE      DATE,
            SHOP_NAME_1      VARCHAR(255),
            SHOP_NAME_2      VARCHAR(255),
            PRODUCT_NAME_1   VARCHAR(500),
            PRODUCT_NAME_2   VARCHAR(500),
            IMAGE_URL_1      VARCHAR(2000),
            IMAGE_URL_2      VARCHAR(2000),
            SIMILARITY_SCORE FLOAT,
            COMPUTED_AT      TIMESTAMP_NTZ
        )
    """)


def fetch_products(cur):
    """Return all products from staging_prices that have a non-empty image_url."""
    cur.execute("""
        SELECT
            scrape_date,
            brand,
            shop_name,
            product_name,
            image_url
        FROM STAGING_PRICES
        WHERE image_url IS NOT NULL
          AND image_url != ''
        ORDER BY scrape_date, brand, shop_name
    """)
    return cur.fetchall()


def fetch_processed_dates(cur):
    """Return (scrape_date, brand) pairs already present in the target table."""
    cur.execute("""
        SELECT DISTINCT scrape_date, product_name_1
        FROM STAGING_SIMILARITY_SCORES
    """)
    # We use scrape_date alone as the incremental key — if any row exists for
    # that date we consider it fully processed.
    return {row[0] for row in cur.fetchall()}


def download_image(url: str):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception as e:
        log.debug("Failed to download %s: %s", url, e)
        return None


def compute_similarity(img_a, img_b) -> float:
    hash_a = imagehash.phash(img_a)
    hash_b = imagehash.phash(img_b)
    distance = hash_a - hash_b
    return round(1.0 - distance / PHASH_BITS, 4)


def run():
    conn = get_conn()
    cur = conn.cursor()

    ensure_table(cur)

    rows = fetch_products(cur)
    if not rows:
        log.info("No products with image_url found in STAGING_PRICES.")
        return

    processed_dates = fetch_processed_dates(cur)

    # Group by (scrape_date, brand)
    groups: dict[tuple, list] = {}
    for scrape_date, brand, shop_name, product_name, image_url in rows:
        key = (scrape_date, brand)
        groups.setdefault(key, []).append((shop_name, product_name, image_url))

    computed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    total_inserted = 0

    for (scrape_date, brand), products in groups.items():
        if scrape_date in processed_dates:
            log.info("Skipping %s / %s — already processed.", scrape_date, brand)
            continue

        log.info("Processing %s / %s (%d products)…", scrape_date, brand, len(products))

        # Download all images for this group
        images = {}
        for shop_name, product_name, image_url in products:
            img = download_image(image_url)
            if img:
                images[(shop_name, product_name, image_url)] = img
            else:
                log.warning("  Could not load image for %s — %s", shop_name, product_name)

        if len(images) < 2:
            log.info("  Not enough images to compare, skipping.")
            continue

        # Compute pairwise similarity
        insert_rows = []
        for (key_a, img_a), (key_b, img_b) in itertools.combinations(images.items(), 2):
            shop_a, name_a, url_a = key_a
            shop_b, name_b, url_b = key_b
            score = compute_similarity(img_a, img_b)
            log.info("  %.4f  %s vs %s", score, name_a, name_b)
            insert_rows.append((
                scrape_date, shop_a, shop_b, name_a, name_b, url_a, url_b, score, computed_at
            ))

        if insert_rows:
            cur.executemany("""
                INSERT INTO STAGING_SIMILARITY_SCORES
                    (SCRAPE_DATE, SHOP_NAME_1, SHOP_NAME_2,
                     PRODUCT_NAME_1, PRODUCT_NAME_2,
                     IMAGE_URL_1, IMAGE_URL_2,
                     SIMILARITY_SCORE, COMPUTED_AT)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, insert_rows)
            conn.commit()
            total_inserted += len(insert_rows)
            log.info("  Inserted %d pairs.", len(insert_rows))

    log.info("Done. Total pairs inserted: %d", total_inserted)
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
