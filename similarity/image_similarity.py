"""
Compute pairwise image similarity scores for Kikkoman products.
# trigger: 2026-05-28

Flow:
  1. Read distinct products from STAGING.STAGING_PRICES
  2. For each (scrape_date, brand) group, download product images and compute
     CLIP embedding cosine similarity for every cross-shop product pair
  3. Write results to STAGING.STAGING_SIMILARITY_SCORES (incremental — skips
     scrape_dates already present in the target table)

CLIP (openai/clip-vit-base-patch32) understands visual semantics — bottle
shape, label content, proportions — giving far more meaningful scores than
perceptual hashing which only sees brightness patterns.

Usage:
    pip install snowflake-connector-python python-dotenv \
                transformers torch Pillow requests numpy
    python similarity/image_similarity.py
"""

import ast
import io
import itertools
import logging
import os
import re
import uuid
from datetime import datetime, timezone

import numpy as np
import requests
import snowflake.connector
import torch
from dotenv import load_dotenv
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

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
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# Pairs with combined_score >= this are considered the same product across shops.
# Calibrated from data: all confirmed same-product pairs score >= 0.62;
# below that, cross-brand / cross-type pairs start appearing.
MATCH_THRESHOLD = 0.65

# Load CLIP model once at startup (~350 MB download on first run)
log.info("Loading CLIP model…")
_PROCESSOR = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
_MODEL = CLIPModel.from_pretrained(CLIP_MODEL_NAME)
_MODEL.eval()
log.info("CLIP model ready.")


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
            SIMILARITY_ID         VARCHAR(36),
            SCRAPE_DATE           DATE,
            SHOP_NAME_1           VARCHAR(255),
            SHOP_NAME_2           VARCHAR(255),
            PRODUCT_NAME_1        VARCHAR(500),
            PRODUCT_NAME_2        VARCHAR(500),
            IMAGE_URL_1           VARCHAR(2000),
            IMAGE_URL_2           VARCHAR(2000),
            IMAGE_SIMILARITY      FLOAT,
            NAME_SIMILARITY       FLOAT,
            COMBINED_SCORE        FLOAT,
            IS_MATCH              BOOLEAN,
            COMPUTED_AT           TIMESTAMP_NTZ
        )
    """)
    # Add new columns if table already existed without them
    for col, dtype in [
        ("SIMILARITY_ID",    "VARCHAR(36)"),
        ("IMAGE_SIMILARITY", "FLOAT"),
        ("NAME_SIMILARITY",  "FLOAT"),
        ("COMBINED_SCORE",   "FLOAT"),
        ("IS_MATCH",         "BOOLEAN"),
    ]:
        cur.execute(f"""
            ALTER TABLE STAGING_SIMILARITY_SCORES
            ADD COLUMN IF NOT EXISTS {col} {dtype}
        """)


def fetch_products(cur):
    """Return all products from staging_prices that have a non-empty image_url."""
    cur.execute("""
        SELECT
            DATE(scraped_at) AS scrape_date,
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
    """Return scrape_dates where ALL pairs were successfully computed.
    A date is considered complete only if the number of rows > 1.
    Single-pair dates may be incomplete due to image download failures."""
    cur.execute("""
        SELECT scrape_date, COUNT(*) AS pair_count
        FROM STAGING_SIMILARITY_SCORES
        GROUP BY scrape_date
    """)
    rows = cur.fetchall()
    return {row[0] for row in rows if row[1] > 1}


def _clean_image_url(url: str) -> str:
    """Extract a plain URL from image_url values stored as JSON-LD ImageObject strings."""
    if not url:
        return ""
    if url.startswith("http"):
        return url
    # Handle cases like "{'@type': 'ImageObject', 'url': 'https://...', ...}"
    try:
        obj = ast.literal_eval(url)
        if isinstance(obj, dict):
            return obj.get("url") or obj.get("contentUrl") or obj.get("image", "")
    except Exception:
        pass
    return ""


def download_image(url: str):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception as e:
        log.debug("Failed to download %s: %s", url, e)
        return None


def get_embedding(img: Image.Image) -> np.ndarray:
    """Return a normalised CLIP image embedding as a 1-D numpy array."""
    inputs = _PROCESSOR(images=img, return_tensors="pt")
    with torch.no_grad():
        # Pass only pixel_values to avoid unexpected keyword arguments
        features = _MODEL.get_image_features(pixel_values=inputs["pixel_values"])
    # Some transformers versions return BaseModelOutputWithPooling instead of a tensor
    if not isinstance(features, torch.Tensor):
        features = features.pooler_output
    features = features / features.norm(dim=-1, keepdim=True)
    return features[0].cpu().numpy()


def compute_image_similarity(img_a: Image.Image, img_b: Image.Image) -> float:
    """Cosine similarity between CLIP embeddings of two images (0.0 – 1.0)."""
    emb_a = get_embedding(img_a)
    emb_b = get_embedding(img_b)
    score = float(np.dot(emb_a, emb_b))
    return round(max(0.0, min(1.0, score)), 4)


# Word pairs that are mutually exclusive — if one name has one term and the
# other has the opposing term, they cannot be the same product.
EXCLUSIVE_PAIRS = [
    ("dark", "light"),
    ("sweet", "less salt"),
    ("sweet", "reduced salt"),
    ("sweet", "tamari"),        # Tamari is savoury/umami, not sweet
    ("sweet", "dark"),          # Sweet soy sauce vs dark soy sauce are different categories
    ("tamari", "koikuchi"),
    ("usukuchi", "koikuchi"),   # Usukuchi = light soy sauce, Koikuchi = dark/regular
    ("usukuchi", "dark"),
    ("light", "koikuchi"),      # "Light Soy Sauce" vs "Koikuchi" are different types
    ("asin", "manis"),          # Indonesian: Kecap Asin (salty) vs Kecap Manis (sweet)
    ("salty", "sweet"),         # English equivalents of the above
]

# Use-specific qualifiers — when present in one name but not the other,
# the products serve different purposes and should not be considered the same.
QUALIFIER_TERMS = [
    "for rice",
    "for seafood",   # use-specific (e.g. Lee Kum Kee Seasoned for Seafood)
    "nama",          # unpasteurised — different from regular
    "ponzu",         # citrus-based — different from plain soy sauce
    "teriyaki",
    "sushi",
    "less salt",
    "reduced salt",
    "reduced sodium",
    "usukuchi",      # pale/light Japanese soy sauce type — if only one name has it, different product
    "double deluxe", # specific LKK product line, different from Premium Dark/Light
]

def _conflict_penalty(name_a: str, name_b: str) -> float:
    """Return 0.2 if names contain mutually exclusive terms, else 1.0."""
    a, b = name_a.lower(), name_b.lower()
    for term_x, term_y in EXCLUSIVE_PAIRS:
        if (term_x in a and term_y in b) or (term_y in a and term_x in b):
            log.debug("  Conflict detected: '%s' vs '%s'", term_x, term_y)
            return 0.2
    return 1.0


def _qualifier_penalty(name_a: str, name_b: str) -> float:
    """Return 0.5 if one name has a use-specific qualifier the other lacks."""
    a, b = name_a.lower(), name_b.lower()
    for term in QUALIFIER_TERMS:
        if (term in a) != (term in b):   # XOR — only one name has it
            log.debug("  Qualifier mismatch: '%s'", term)
            return 0.5
    return 1.0


def _extract_volume_ml(name: str) -> float | None:
    """Extract volume in ml from a product name string.

    Handles patterns like '500ml', '1L', '1.5l', '250 ml'.
    Returns None when no volume is found.
    """
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(l|ml)\b', name.lower())
    if not m:
        return None
    val = float(m.group(1).replace(',', '.'))
    return val * 1000 if m.group(2) == 'l' else val


def _volume_penalty(name_a: str, name_b: str) -> float:
    """Return 0.5 if both names specify a volume and the volumes differ.

    Different volumes mean different SKUs — not useful for price comparison
    even if the product type is the same (e.g. Kikkoman Less Salt 1L vs 250ml).
    A 5 % tolerance handles rounding edge-cases ('1l' == '1000ml').
    """
    vol_a = _extract_volume_ml(name_a)
    vol_b = _extract_volume_ml(name_b)
    if vol_a is None or vol_b is None:
        return 1.0  # volume unknown for one side — cannot penalise
    if abs(vol_a - vol_b) / max(vol_a, vol_b) > 0.05:
        log.debug("  Volume mismatch: %.0fml vs %.0fml", vol_a, vol_b)
        return 0.5
    return 1.0


def compute_name_similarity(name_a: str, name_b: str) -> float:
    """Jaccard similarity on word tokens (0.0 – 1.0).

    Normalises both names to lowercase alphanumeric tokens, then computes
    intersection / union.  Captures shared words like brand names, volumes,
    and product descriptors while penalising names with very different terms.

    Example:
        'Sweet Soy Sauce for Rice (Kikkoman) 250ml'
        vs 'Kikkoman Sojasaus, 250ml'
        tokens_a = {sweet, soy, sauce, for, rice, kikkoman, 250ml}
        tokens_b = {kikkoman, sojasaus, 250ml}
        intersection = {kikkoman, 250ml}  →  score = 2/8 = 0.25
    """
    def tokenise(s: str) -> set[str]:
        return set(re.sub(r"[^a-z0-9]", " ", s.lower()).split())

    tokens_a = tokenise(name_a)
    tokens_b = tokenise(name_b)
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return round(len(intersection) / len(union), 4)


def run():
    conn = get_conn()
    cur = conn.cursor()

    ensure_table(cur)

    # Remove any same-shop pairs inserted before this filter was added
    cur.execute("""
        DELETE FROM STAGING_SIMILARITY_SCORES
        WHERE SHOP_NAME_1 = SHOP_NAME_2
    """)
    conn.commit()
    log.info("Removed same-shop pairs from STAGING_SIMILARITY_SCORES.")

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
            clean_url = _clean_image_url(image_url)
            if not clean_url:
                log.warning("  No valid image URL for %s — %s", shop_name, product_name)
                continue
            img = download_image(clean_url)
            if img:
                images[(shop_name, product_name, clean_url)] = img
            else:
                log.warning("  Could not load image for %s — %s", shop_name, product_name)

        if len(images) < 2:
            log.info("  Not enough images to compare, skipping.")
            continue

        # Compute pairwise CLIP similarity (cross-shop only)
        insert_rows = []
        for (key_a, img_a), (key_b, img_b) in itertools.combinations(images.items(), 2):
            shop_a, name_a, url_a = key_a
            shop_b, name_b, url_b = key_b
            if shop_a == shop_b:
                continue
            img_score  = compute_image_similarity(img_a, img_b)
            name_score = compute_name_similarity(name_a, name_b)
            penalty    = (_conflict_penalty(name_a, name_b)
                         * _qualifier_penalty(name_a, name_b)
                         * _volume_penalty(name_a, name_b))
            # Geometric mean scaled by conflict + qualifier + volume penalties
            combined   = round((img_score * name_score) ** 0.5 * penalty, 4)
            is_match   = combined >= MATCH_THRESHOLD
            similarity_id = str(uuid.uuid4())
            log.info("  img=%.4f name=%.4f combined=%.4f is_match=%s  %s vs %s",
                     img_score, name_score, combined, is_match, name_a, name_b)
            insert_rows.append((
                similarity_id, scrape_date, shop_a, shop_b, name_a, name_b,
                url_a, url_b, img_score, name_score, combined, is_match, computed_at
            ))

        if insert_rows:
            # Remove any incomplete rows from a previous failed run for this date
            cur.execute("""
                DELETE FROM STAGING_SIMILARITY_SCORES WHERE SCRAPE_DATE = %s
            """, (scrape_date,))

            cur.executemany("""
                INSERT INTO STAGING_SIMILARITY_SCORES
                    (SIMILARITY_ID, SCRAPE_DATE, SHOP_NAME_1, SHOP_NAME_2,
                     PRODUCT_NAME_1, PRODUCT_NAME_2,
                     IMAGE_URL_1, IMAGE_URL_2,
                     IMAGE_SIMILARITY, NAME_SIMILARITY, COMBINED_SCORE,
                     IS_MATCH, COMPUTED_AT)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, insert_rows)
            conn.commit()
            total_inserted += len(insert_rows)
            log.info("  Inserted %d pairs.", len(insert_rows))

    log.info("Done. Total pairs inserted: %d", total_inserted)
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
