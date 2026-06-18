"""
Generate ground_truth.csv using Claude Vision as an independent oracle.

Flow:
  1. Read all distinct cross-shop pairs from STAGING.STAGING_SIMILARITY_SCORES
     (image URLs already stored there from the DINOv2 pipeline run)
  2. For each pair, download both product images
  3. Send product names + images to Claude Haiku — completely independent from the
     DINOv2 / colour-histogram pipeline
  4. Write SAME / DIFFERENT pairs to ground_truth.csv
  5. Write UNCERTAIN pairs to ground_truth_uncertain.csv for manual review

Why Claude Vision as oracle?
  DINOv2 reasons about pixel-level visual structure. Claude Vision reasons about
  semantic product identity (brand marks, label text, product type). These are
  genuinely independent signals, so Claude's verdicts are valid ground truth for
  measuring recall and precision of the main matching pipeline.

Output files:
  ground_truth.csv          — all SAME and DIFFERENT verdicts (labelled ground truth)
  ground_truth_uncertain.csv — pairs Claude could not confidently judge (manual review)

Usage:
    pip install anthropic google-cloud-bigquery python-dotenv Pillow requests
    python similarity/generate_ground_truth.py
"""

import ast
import base64
import csv
import io
import logging
import os
import time

import requests
from anthropic import Anthropic
from dotenv import load_dotenv
from google.cloud import bigquery
from PIL import Image

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT      = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
SIMILARITY_TABLE = f"{GCP_PROJECT}.staging.staging_similarity_scores"
CLAUDE_MODEL     = "claude-haiku-4-5-20251001"

OUTPUT_PATH    = os.path.join(os.path.dirname(__file__), "ground_truth.csv")
UNCERTAIN_PATH = os.path.join(os.path.dirname(__file__), "ground_truth_uncertain.csv")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
TIMEOUT            = 15
RATE_LIMIT_DELAY   = 0.3   # seconds between Claude API calls to stay within rate limits


# ---------------------------------------------------------------------------
# BigQuery
# ---------------------------------------------------------------------------

def get_bq_client() -> bigquery.Client:
    return bigquery.Client(project=GCP_PROJECT)


def fetch_pairs(client: bigquery.Client) -> list[dict]:
    """Return all distinct cross-shop pairs that have image URLs on both sides."""
    rows = client.query(f"""
        SELECT DISTINCT
            SHOP_NAME_1,    PRODUCT_NAME_1,    IMAGE_URL_1,
            SHOP_NAME_2,    PRODUCT_NAME_2,    IMAGE_URL_2
        FROM `{SIMILARITY_TABLE}`
        WHERE SHOP_NAME_1 != SHOP_NAME_2
          AND IMAGE_URL_1 IS NOT NULL AND IMAGE_URL_1 != ''
          AND IMAGE_URL_2 IS NOT NULL AND IMAGE_URL_2 != ''
        ORDER BY SHOP_NAME_1, PRODUCT_NAME_1, SHOP_NAME_2
    """).result()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Image helpers (mirrors image_similarity.py logic)
# ---------------------------------------------------------------------------

def _clean_image_url(url: str) -> str:
    """Extract a plain URL from values that may be stored as JSON-LD ImageObject strings."""
    if not url:
        return ""
    if url.startswith("http"):
        return url
    try:
        obj = ast.literal_eval(url)
        if isinstance(obj, dict):
            return obj.get("url") or obj.get("contentUrl") or obj.get("image", "")
    except Exception:
        pass
    return ""


def download_image_b64(url: str) -> str | None:
    """Download image and return as JPEG base64 string, or None on failure."""
    clean = _clean_image_url(url)
    if not clean:
        return None
    try:
        r = requests.get(clean, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.standard_b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        log.warning("  Image download failed (%s): %s", clean[:60], e)
        return None


# ---------------------------------------------------------------------------
# Claude Vision oracle
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a product-matching expert for a soy sauce price-comparison database.
Determine whether two product listings refer to exactly the same physical SKU —
meaning identical brand, identical product type (e.g. regular soy sauce vs tamari
are NOT the same), and identical volume.

Reply with exactly one word:
  SAME       — you are confident these are the same SKU
  DIFFERENT  — you are confident these are different products
  UNCERTAIN  — you cannot judge confidently from the information provided

Single word only. No explanation."""


def _build_content(
    shop_a: str, name_a: str, img_a: str | None,
    shop_b: str, name_b: str, img_b: str | None,
) -> list[dict]:
    """Build the Claude message content list, including images when available."""
    content: list[dict] = []

    def add_product(shop: str, name: str, img: str | None, label: str) -> None:
        content.append({"type": "text", "text": f"{label} (shop: {shop})\nName: {name}"})
        if img:
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": img},
            })
        else:
            content.append({"type": "text", "text": "(image unavailable)"})

    add_product(shop_a, name_a, img_a, "Product A")
    add_product(shop_b, name_b, img_b, "Product B")
    content.append({"type": "text", "text": "Are these the same product SKU?"})
    return content


def judge_pair(
    client: Anthropic,
    shop_a: str, name_a: str, img_a: str | None,
    shop_b: str, name_b: str, img_b: str | None,
) -> str:
    """Ask Claude Haiku to judge whether two products are the same SKU.
    Returns 'SAME', 'DIFFERENT', or 'UNCERTAIN'."""
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=10,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": _build_content(shop_a, name_a, img_a, shop_b, name_b, img_b),
        }],
    )
    verdict = response.content[0].text.strip().upper()
    if verdict not in ("SAME", "DIFFERENT", "UNCERTAIN"):
        log.warning("  Unexpected verdict '%s' — treating as UNCERTAIN", verdict)
        return "UNCERTAIN"
    return verdict


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

FIELDNAMES = ["shop_name_1", "product_name_1", "shop_name_2", "product_name_2", "verdict"]


def run() -> None:
    bq_client     = get_bq_client()
    claude_client = Anthropic()

    log.info("Fetching cross-shop pairs from BigQuery…")
    pairs = fetch_pairs(bq_client)
    log.info("Found %d pairs to evaluate.", len(pairs))

    same_rows:      list[dict] = []
    different_rows: list[dict] = []
    uncertain_rows: list[dict] = []

    for i, pair in enumerate(pairs, 1):
        shop_a = pair["SHOP_NAME_1"];  name_a = pair["PRODUCT_NAME_1"];  url_a = pair["IMAGE_URL_1"]
        shop_b = pair["SHOP_NAME_2"];  name_b = pair["PRODUCT_NAME_2"];  url_b = pair["IMAGE_URL_2"]

        log.info("[%d/%d] [%s] %s  ↔  [%s] %s", i, len(pairs), shop_a, name_a, shop_b, name_b)

        img_a   = download_image_b64(url_a)
        img_b   = download_image_b64(url_b)
        verdict = judge_pair(claude_client, shop_a, name_a, img_a, shop_b, name_b, img_b)
        log.info("  → %s", verdict)

        row = dict(shop_name_1=shop_a, product_name_1=name_a,
                   shop_name_2=shop_b, product_name_2=name_b, verdict=verdict)
        if verdict == "SAME":
            same_rows.append(row)
        elif verdict == "DIFFERENT":
            different_rows.append(row)
        else:
            uncertain_rows.append(row)

        time.sleep(RATE_LIMIT_DELAY)

    # ground_truth.csv — all confident labels (SAME + DIFFERENT)
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(same_rows)
        writer.writerows(different_rows)

    # ground_truth_uncertain.csv — pairs needing manual review
    with open(UNCERTAIN_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(uncertain_rows)

    log.info(
        "Done.  SAME=%d  DIFFERENT=%d  UNCERTAIN=%d",
        len(same_rows), len(different_rows), len(uncertain_rows),
    )
    log.info("Ground truth  → %s", OUTPUT_PATH)
    log.info("Manual review → %s", UNCERTAIN_PATH)
    log.info("")
    log.info("Next step: run evaluate_matching.py to get Precision / Recall / F1")


if __name__ == "__main__":
    run()
