"""
Compute pairwise image similarity scores for Kikkoman products.
# trigger: 2026-05-28e

Flow:
  1. Read distinct products from STAGING.STAGING_PRICES
  2. For each (scrape_date, brand) group, download product images and compute
     DINOv2 embedding cosine similarity for every cross-shop product pair
  3. Write results to STAGING.STAGING_SIMILARITY_SCORES (full refresh on every run)

Model: DINOv2 (facebook/dinov2-base)
  Self-supervised ViT trained purely on visual features — no language bias.
  Unlike CLIP, it does not cluster "Asian condiment bottles" together just
  because they share a semantic category; it responds to actual visual
  differences in label colour, shape, and texture.

Combined score: IMAGE_SIMILARITY × penalties
  Text-based penalties (conflict, qualifier, volume) are still applied on top
  of the image score; NAME_SIMILARITY is computed and stored for reference only.

Usage:
    pip install google-cloud-bigquery python-dotenv \
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
from zoneinfo import ZoneInfo

import numpy as np
import requests
import torch
from dotenv import load_dotenv
from google.cloud import bigquery
from PIL import Image
from rembg import remove as rembg_remove
from transformers import AutoImageProcessor, AutoModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
TABLE_ID    = f"{GCP_PROJECT}.staging.staging_similarity_scores"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
TIMEOUT = 15
DINO_MODEL_NAME = "facebook/dinov2-base"

# Pairs with combined_score >= this are considered the same product across shops.
# DINOv2 cosine similarity for the exact same product image is typically 0.95+;
# clearly different products score 0.3–0.6. Threshold set at 0.85 to require
# strong visual agreement — calibrated from data: confirmed match
# "Naturally Brewed Soy Sauce (Yamasa) 150ml" vs "Yamasa Soy Sauce 150ml"
# scores 0.81 with no penalties applied.
MATCH_THRESHOLD = 0.80

# Load DINOv2 model once at startup (~330 MB download on first run)
log.info("Loading DINOv2 model…")
_PROCESSOR = AutoImageProcessor.from_pretrained(DINO_MODEL_NAME)
_MODEL     = AutoModel.from_pretrained(DINO_MODEL_NAME)
_MODEL.eval()
log.info("DINOv2 model ready.")


def get_client():
    return bigquery.Client(project=GCP_PROJECT)


def ensure_table(client: bigquery.Client) -> None:
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{TABLE_ID}` (
            SIMILARITY_ID         STRING,
            SCRAPE_DATE           DATE,
            SHOP_NAME_1           STRING,
            SHOP_NAME_2           STRING,
            PRODUCT_NAME_1        STRING,
            PRODUCT_NAME_2        STRING,
            IMAGE_URL_1           STRING,
            IMAGE_URL_2           STRING,
            IMAGE_SIMILARITY      FLOAT64,
            NAME_SIMILARITY       FLOAT64,
            COMBINED_SCORE        FLOAT64,
            IS_MATCH              BOOL,
            COMPUTED_AT           TIMESTAMP
        )
    """).result()


def fetch_products(client: bigquery.Client):
    """Return all products from raw_kikkoman_prices that have a non-empty image_url."""
    result = client.query(f"""
        SELECT
            DATE(scraped_at) AS scrape_date,
            'Kikkoman'       AS brand,
            shop_name,
            product_name,
            image_url
        FROM `{GCP_PROJECT}.raw.raw_kikkoman_prices`
        WHERE image_url IS NOT NULL
          AND image_url != ''
        ORDER BY scrape_date, brand, shop_name
    """).result()
    return [tuple(row) for row in result]


def fetch_processed_dates(client: bigquery.Client):
    """Return scrape_dates where ALL pairs were successfully computed.
    A date is considered complete only if the number of rows > 1.
    Single-pair dates may be incomplete due to image download failures."""
    result = client.query(f"""
        SELECT scrape_date, COUNT(*) AS pair_count
        FROM `{TABLE_ID}`
        GROUP BY scrape_date
    """).result()
    rows = [tuple(row) for row in result]
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


def remove_background(img: Image.Image) -> Image.Image:
    """Strip background from a product image, returning RGB on a white canvas.

    rembg uses a U2Net segmentation model to isolate the foreground object.
    Compositing onto white ensures DINOv2 sees a consistent background rather
    than shop-specific props, gradients, or coloured backgrounds that would
    inflate or deflate cosine similarity unrelated to the product itself.
    Falls back to the original image if removal fails.
    """
    try:
        rgba = rembg_remove(img.convert("RGBA"))          # transparent background
        white = Image.new("RGB", rgba.size, (255, 255, 255))
        white.paste(rgba, mask=rgba.split()[3])            # alpha channel as mask
        return white
    except Exception as e:
        log.warning("  Background removal failed, using original: %s", e)
        return img.convert("RGB")


def remove_dark_liquid(img: Image.Image, threshold: int = 60) -> Image.Image:
    """Replace near-black pixels (soy sauce liquid visible through glass) with white.

    The dark liquid is the same near-black colour across every soy sauce product,
    so it dominates DINOv2's embedding and inflates similarity between different
    products. Replacing these pixels with white forces the model to compare only
    the discriminative visual features: bottle shape, label design/colour, lid.

    threshold: pixels with R, G, B all below this value are treated as dark liquid.
    60 captures the near-black soy sauce while keeping coloured label elements.
    """
    arr = np.array(img)
    dark = (arr[:, :, 0] < threshold) & (arr[:, :, 1] < threshold) & (arr[:, :, 2] < threshold)
    arr[dark] = [255, 255, 255]
    return Image.fromarray(arr.astype(np.uint8))


def download_image(url: str):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
        img = remove_background(img)    # strip shop background
        img = remove_dark_liquid(img)   # strip soy sauce liquid inside bottle
        return img
    except Exception as e:
        log.debug("Failed to download %s: %s", url, e)
        return None


def get_embedding(img: Image.Image) -> np.ndarray:
    """Return a normalised DINOv2 CLS-token embedding as a 1-D numpy array."""
    inputs = _PROCESSOR(images=img, return_tensors="pt")
    with torch.no_grad():
        outputs = _MODEL(**inputs)
    # CLS token is the first token of the last hidden state
    features = outputs.last_hidden_state[:, 0, :]
    features = features / features.norm(dim=-1, keepdim=True)
    return features[0].cpu().numpy()


def compute_color_histogram_similarity(img_a: Image.Image, img_b: Image.Image) -> float:
    """Cosine similarity between normalised RGB histograms of coloured pixels only.

    Excludes near-white pixels (background whitened by remove_background) and
    near-black pixels (dark liquid whitened by remove_dark_liquid) so the
    histogram captures only the discriminative coloured regions: lid and label.

    Without this exclusion, both post-processed images are ~90 % white, making
    their full histograms nearly identical and the score ~0.95 regardless of
    whether one lid is green and the other is red.

    Falls back to the full image if fewer than 100 coloured pixels remain.
    bins=32 per channel → 96-dim vector; coarser than pixel-level but robust
    to minor lighting variation.
    """
    WHITE_THR = 200   # R,G,B all above → background / whitened area
    BLACK_THR = 60    # R,G,B all below → residual dark pixels (guard)

    def hist(img: Image.Image, bins: int = 32) -> np.ndarray:
        arr = np.array(img).reshape(-1, 3).astype(np.float32)
        is_white = (arr[:, 0] > WHITE_THR) & (arr[:, 1] > WHITE_THR) & (arr[:, 2] > WHITE_THR)
        is_black = (arr[:, 0] < BLACK_THR) & (arr[:, 1] < BLACK_THR) & (arr[:, 2] < BLACK_THR)
        colored = arr[~(is_white | is_black)]
        if len(colored) < 100:     # almost no colour — fall back to full image
            log.debug("  histogram: too few coloured pixels (%d), using full image", len(colored))
            colored = arr
        h = np.concatenate([
            np.histogram(colored[:, c], bins=bins, range=(0, 256))[0]
            for c in range(3)
        ]).astype(np.float32)
        norm = h.sum()
        return h / (norm + 1e-9)

    ha, hb = hist(img_a), hist(img_b)
    norm_a = np.linalg.norm(ha)
    norm_b = np.linalg.norm(hb)
    score = float(np.dot(ha, hb) / (norm_a * norm_b + 1e-9))
    return round(max(0.0, min(1.0, score)), 4)


def compute_image_similarity(img_a: Image.Image, img_b: Image.Image) -> float:
    """Geometric mean of DINOv2 structural similarity and colour histogram similarity.

    DINOv2 CLS token captures bottle shape and label layout well but is largely
    colour-agnostic — a green-label and a red-label 1 L bottle score ~0.89.
    The colour histogram component penalises pairs whose overall colour
    distributions differ (green vs red label → ~0.4), pulling the geometric
    mean down to ~0.6 and away from the IS_MATCH threshold.

    Geometric mean chosen over arithmetic mean so that a near-zero score on
    either component collapses the combined score toward zero.
    """
    dino_score  = float(np.dot(get_embedding(img_a), get_embedding(img_b)))
    dino_score  = max(0.0, min(1.0, dino_score))
    color_score = compute_color_histogram_similarity(img_a, img_b)
    score = (dino_score * color_score) ** 0.5
    log.debug("  dino=%.4f color=%.4f → image=%.4f", dino_score, color_score, score)
    return round(max(0.0, min(1.0, score)), 4)


# Word pairs that are mutually exclusive — if one name has one term and the
# other has the opposing term, they cannot be the same product.
EXCLUSIVE_PAIRS = [
    ("dark", "light"),
    ("sweet", "less salt"),
    ("sweet", "reduced salt"),
    ("sweet", "tamari"),        # Tamari is savoury/umami, not sweet
    ("sweet", "dark"),          # Sweet soy sauce vs dark soy sauce are different categories
    ("thin", "black"),          # Thin soy sauce vs Black soy sauce are opposite types
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


# Canonical brand names. Checked after NAME_ALIASES are applied so that
# alternate-language brand names (e.g. "healthy boy" → "dek som boon")
# are resolved before comparison.
KNOWN_BRANDS = [
    "kikkoman",
    "yamasa",
    "abc",
    "pearl river bridge",
    "lee kum kee",
    "sempio",
    "marukin",
    "silver swan",
    "mee chun",
    "dek som boon",   # "healthy boy" aliased to this
    "kishibori",
    "tokusen",        # premium Kikkoman/artisan line — distinct from generic brands
]


def _name_mismatch_penalty(name_similarity: float) -> float:
    """Return 0.3 when the two product names share almost no tokens (Jaccard < 0.10).

    Acts as a safety net for pairs where the image model is fooled by visually
    similar bottles but the names are completely different — e.g.
    "Koikuchi Shoyu 500ML" vs "Sempio Rich & Mellow Jin S 500ml" share only
    the volume token '500ml', giving Jaccard = 0.09.

    Threshold 0.10 is very conservative: legitimate cross-language matches
    (Healthy Boy → Dek Som Boon alias) and differently-worded same-product
    names both score well above 0.10 after alias normalisation.
    """
    if name_similarity < 0.10:
        log.debug("  Name mismatch penalty: name_similarity=%.4f < 0.10", name_similarity)
        return 0.3
    return 1.0


def _brand_conflict_penalty(name_a: str, name_b: str) -> float:
    """Return 0.2 if the names reference different known brands.

    Applies NAME_ALIASES first so alternate-language brand names resolve
    to the same canonical token before comparison.
    Different brands = definitely different products, regardless of image score.
    """
    a = _normalize_name(name_a)
    b = _normalize_name(name_b)
    brands_a = {brand for brand in KNOWN_BRANDS if brand in a}
    brands_b = {brand for brand in KNOWN_BRANDS if brand in b}
    if brands_a and brands_b and not (brands_a & brands_b):
        log.debug("  Brand conflict: %s vs %s", brands_a, brands_b)
        return 0.2
    return 1.0


# Known aliases applied before tokenising.
# Each entry maps a phrase to its canonical form so that Jaccard
# treats equivalent names as identical tokens.
# Key insight: order matters — longer phrases must come before their sub-words.
NAME_ALIASES: dict[str, str] = {
    # Brand name equivalences (English ↔ Thai/Japanese alternate names)
    "healthy boy":  "dek som boon",   # same brand, different language
    # Romanisation variants of Japanese 醤油
    "shouyu":       "shoyu",
    # Dutch ↔ English
    "sojasaus":     "soy sauce",
    # Japanese product-type terms → English equivalents (triggers qualifier penalty)
    "gen'en":       "reduced salt",   # 減塩 = reduced salt (Kikkoman Gen'en line)
    "genen":        "reduced salt",   # alternate romanisation without apostrophe
}


def _normalize_name(name: str) -> str:
    """Apply NAME_ALIASES substitutions (longest-first) before tokenising."""
    n = name.lower()
    for alias, canonical in NAME_ALIASES.items():
        n = n.replace(alias, canonical)
    return n


def compute_name_similarity(name_a: str, name_b: str) -> float:
    """Jaccard similarity on word tokens (0.0 – 1.0).

    Normalises both names via NAME_ALIASES then to lowercase alphanumeric
    tokens, and computes intersection / union.

    Example after alias resolution:
        'Thin Soy Sauce (Healthy Boy) 700ml'
        → 'thin soy sauce (dek som boon) 700ml'
        vs 'Dek Som Boon Dek Som Boon Thin Soy Sauce, 700ml'
        → tokens both contain {thin, soy, sauce, dek, som, boon, 700ml}
        → Jaccard = 1.0  (was 0.44 before alias)
    """
    def tokenise(s: str) -> set[str]:
        return set(re.sub(r"[^a-z0-9]", " ", _normalize_name(s)).split())

    tokens_a = tokenise(name_a)
    tokens_b = tokenise(name_b)
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return round(len(intersection) / len(union), 4)


def run():
    client = get_client()

    ensure_table(client)

    # Remove any same-shop pairs inserted before this filter was added
    client.query(f"""
        DELETE FROM `{TABLE_ID}`
        WHERE SHOP_NAME_1 = SHOP_NAME_2
    """).result()
    log.info("Removed same-shop pairs from staging_similarity_scores.")

    rows = fetch_products(client)
    if not rows:
        log.info("No products with image_url found in raw_kikkoman_prices.")
        return

    processed_dates = fetch_processed_dates(client)

    # Group by (scrape_date, brand)
    groups: dict[tuple, list] = {}
    for scrape_date, brand, shop_name, product_name, image_url in rows:
        key = (scrape_date, brand)
        groups.setdefault(key, []).append((shop_name, product_name, image_url))

    computed_at = datetime.now(ZoneInfo("Europe/Amsterdam")).strftime("%Y-%m-%d %H:%M:%S")
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
            name_score = compute_name_similarity(name_a, name_b)  # stored for reference
            penalty    = (_conflict_penalty(name_a, name_b)
                         * _qualifier_penalty(name_a, name_b)
                         * _volume_penalty(name_a, name_b)
                         * _brand_conflict_penalty(name_a, name_b)
                         * _name_mismatch_penalty(name_score))
            # Image similarity × text penalties (name not in base score)
            combined   = round(img_score * penalty, 4)
            is_match   = bool(combined >= MATCH_THRESHOLD)
            similarity_id = str(uuid.uuid4())
            log.info("  img=%.4f name=%.4f combined=%.4f is_match=%s  %s vs %s",
                     img_score, name_score, combined, is_match, name_a, name_b)
            insert_rows.append({
                "SIMILARITY_ID":    similarity_id,
                "SCRAPE_DATE":      str(scrape_date),
                "SHOP_NAME_1":      shop_a,
                "SHOP_NAME_2":      shop_b,
                "PRODUCT_NAME_1":   name_a,
                "PRODUCT_NAME_2":   name_b,
                "IMAGE_URL_1":      url_a,
                "IMAGE_URL_2":      url_b,
                "IMAGE_SIMILARITY": img_score,
                "NAME_SIMILARITY":  name_score,
                "COMBINED_SCORE":   combined,
                "IS_MATCH":         is_match,
                "COMPUTED_AT":      computed_at,
            })

        if insert_rows:
            # Remove any incomplete rows from a previous failed run for this date
            client.query(f"""
                DELETE FROM `{TABLE_ID}` WHERE SCRAPE_DATE = '{scrape_date}'
            """).result()

            job_config = bigquery.LoadJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            )
            client.load_table_from_json(insert_rows, TABLE_ID, job_config=job_config).result()
            total_inserted += len(insert_rows)
            log.info("  Inserted %d pairs.", len(insert_rows))

    log.info("Done. Total pairs inserted: %d", total_inserted)


if __name__ == "__main__":
    run()
