"""
Generate ground_truth.csv using Groq (Llama 3.2 Vision) as an independent oracle.

Flow:
  1. Read all distinct cross-shop pairs from STAGING.STAGING_SIMILARITY_SCORES
     (most recent scrape date only — avoids repeating the same pairs per date)
  2. For each pair, download both product images as base64 JPEG
  3. Send product names + images to Llama 3.2 Vision via Groq for judgment
     — completely separate from the DINOv2 / colour-histogram pipeline
  4. Write SAME / DIFFERENT pairs to ground_truth.csv
  5. Write UNCERTAIN pairs to ground_truth_uncertain.csv for manual review

Why Groq / Llama 3.2 Vision as oracle?
  DINOv2 reasons about pixel-level visual structure. Llama Vision reasons about
  semantic product identity (brand marks, label text, product type, volume).
  Genuinely independent signals → valid ground truth for Recall / Precision / F1.

  Groq free tier: ~30 RPM for vision models — sufficient for ~500 pairs in <30 min.
  Uses the same GROQ_API_KEY already in use by the Telegram bot scoring pipeline.

Output files:
  ground_truth.csv           — SAME and DIFFERENT verdicts (labelled ground truth)
  ground_truth_uncertain.csv — pairs the model could not confidently judge

Usage:
    pip install groq google-cloud-bigquery python-dotenv Pillow requests
    GROQ_API_KEY=<key> python similarity/generate_ground_truth.py
"""

import ast
import base64
import csv
import io
import logging
import os
import time

import requests
from dotenv import load_dotenv
from google.cloud import bigquery
from groq import Groq
from PIL import Image

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT      = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
SIMILARITY_TABLE = f"{GCP_PROJECT}.staging.staging_similarity_scores"
GROQ_MODEL       = "llama-3.2-11b-vision-preview"

OUTPUT_PATH    = os.path.join(os.path.dirname(__file__), "ground_truth.csv")
UNCERTAIN_PATH = os.path.join(os.path.dirname(__file__), "ground_truth_uncertain.csv")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
TIMEOUT          = 15
RATE_LIMIT_DELAY = 2.1  # ~30 RPM free tier → stay safely under 1 req/2s


# ---------------------------------------------------------------------------
# BigQuery
# ---------------------------------------------------------------------------

def get_bq_client() -> bigquery.Client:
    return bigquery.Client(project=GCP_PROJECT)


def fetch_pairs(client: bigquery.Client) -> list[dict]:
    """Return distinct cross-shop pairs from the most recent scrape date only."""
    rows = client.query(f"""
        SELECT DISTINCT
            SHOP_NAME_1,    PRODUCT_NAME_1,    IMAGE_URL_1,
            SHOP_NAME_2,    PRODUCT_NAME_2,    IMAGE_URL_2
        FROM `{SIMILARITY_TABLE}`
        WHERE SCRAPE_DATE = (SELECT MAX(SCRAPE_DATE) FROM `{SIMILARITY_TABLE}`)
          AND SHOP_NAME_1 != SHOP_NAME_2
          AND IMAGE_URL_1 IS NOT NULL AND IMAGE_URL_1 != ''
          AND IMAGE_URL_2 IS NOT NULL AND IMAGE_URL_2 != ''
        ORDER BY SHOP_NAME_1, PRODUCT_NAME_1, SHOP_NAME_2
    """).result()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _clean_image_url(url: str) -> str:
    """Extract a plain URL from values stored as JSON-LD ImageObject strings."""
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
    """Download image and return base64-encoded JPEG string, or None on failure."""
    clean = _clean_image_url(url)
    if not clean:
        return None
    try:
        r = requests.get(clean, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return base64.standard_b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        log.warning("  Image download failed (%s): %s", clean[:60], e)
        return None


# ---------------------------------------------------------------------------
# Groq Vision oracle
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


def _img_part(b64: str) -> dict:
    return {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}


def judge_pair(
    client: Groq,
    shop_a: str, name_a: str, img_a: str | None,
    shop_b: str, name_b: str, img_b: str | None,
) -> str:
    """Ask Llama Vision via Groq whether two products are the same SKU.
    Returns 'SAME', 'DIFFERENT', or 'UNCERTAIN'."""
    content: list = [{"type": "text", "text": f"Product A (shop: {shop_a})\nName: {name_a}"}]
    content.append(_img_part(img_a) if img_a else {"type": "text", "text": "(image unavailable)"})
    content.append({"type": "text", "text": f"Product B (shop: {shop_b})\nName: {name_b}"})
    content.append(_img_part(img_b) if img_b else {"type": "text", "text": "(image unavailable)"})
    content.append({"type": "text", "text": "Are these the same product SKU?"})

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": content},
        ],
        max_tokens=10,
    )
    verdict = response.choices[0].message.content.strip().upper()
    if verdict not in ("SAME", "DIFFERENT", "UNCERTAIN"):
        log.warning("  Unexpected verdict '%s' — treating as UNCERTAIN", verdict)
        return "UNCERTAIN"
    return verdict


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

FIELDNAMES = ["shop_name_1", "product_name_1", "shop_name_2", "product_name_2", "verdict"]


def run() -> None:
    bq_client = get_bq_client()
    client    = Groq(api_key=os.environ.get("GROQ_API_KEY"))

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
        verdict = judge_pair(client, shop_a, name_a, img_a, shop_b, name_b, img_b)
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

    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(same_rows)
        writer.writerows(different_rows)

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
