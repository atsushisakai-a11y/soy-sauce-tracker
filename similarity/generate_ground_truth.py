"""
Generate ground_truth.csv using Groq (Llama 4 Scout) — same-brand pairs only.

Optimization vs naive all-pairs approach:
  Naive: 4,520 cross-shop pairs → exhausts Groq free-tier token budget in one run.
  Optimised: filter to same-brand pairs first → typically 5–10% of all pairs.

  Brand filtering uses keyword matching against brand_list.csv (brand + keyword columns).
  A product name containing "kikkoman" → KIKKOMAN, "hb" → HEALTHY BOY, etc.
  New products are matched automatically without updating brand_list.csv, as long as
  the brand keyword appears somewhere in the product name.

  Step 1 — Brand filtering (this script):
      Only pairs where both products share the same known brand are evaluated.
      A KIKKOMAN vs LEE KUM KEE pair is trivially DIFFERENT — no LLM call needed.

  Step 2 — Similarity evaluation (this script):
      Send the filtered same-brand pairs to Llama 4 Scout (text-only, ~180 tok/call).

Resume/checkpoint:
  Results are written immediately. Re-running skips already-processed pairs.

Usage:
    pip install groq google-cloud-bigquery python-dotenv
    GROQ_API_KEY=<key> python similarity/generate_ground_truth.py
"""

import csv
import logging
import os
import time

from dotenv import load_dotenv
from google.cloud import bigquery
from groq import Groq

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
RAW_TABLE   = f"{GCP_PROJECT}.raw.raw_kikkoman_prices"
GROQ_MODEL  = "meta-llama/llama-4-scout-17b-16e-instruct"

BRAND_LIST_PATH = os.path.join(os.path.dirname(__file__), "brand_list.csv")
OUTPUT_PATH     = os.path.join(os.path.dirname(__file__), "ground_truth.csv")
UNCERTAIN_PATH  = os.path.join(os.path.dirname(__file__), "ground_truth_uncertain.csv")
FIELDNAMES      = ["shop_name_1", "product_name_1", "brand_1",
                   "shop_name_2", "product_name_2", "brand_2", "verdict"]

RATE_LIMIT_DELAY = 2.1


# ---------------------------------------------------------------------------
# Brand detection via keyword matching
# ---------------------------------------------------------------------------

def load_brand_keywords(path: str) -> list[tuple[str, str]]:
    """Load brand_list.csv → [(brand, keyword), ...]. Returns [] if file missing."""
    if not os.path.exists(path):
        log.warning("brand_list.csv not found at %s — running without brand filter.", path)
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return [(row["brand"], row["keyword"].lower()) for row in csv.DictReader(f)]


def detect_brand(product_name: str, brand_keywords: list[tuple[str, str]]) -> str:
    name_lower = product_name.lower()
    for brand, keyword in brand_keywords:
        if keyword in name_lower:
            return brand
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# BigQuery
# ---------------------------------------------------------------------------

def fetch_pairs(client: bigquery.Client) -> list[dict]:
    """Return distinct cross-shop pairs from the most recent scrape, one direction only.

    Filters to same-volume pairs with normalised units (1l/1liter → 1000ml)
    to avoid trivially different pairs like 150ml vs 1L consuming Groq quota.
    """
    rows = client.query(f"""
        WITH products AS (
            SELECT
                SHOP_NAME,
                PRODUCT_NAME,
                CASE
                    WHEN REGEXP_CONTAINS(LOWER(PRODUCT_NAME), '[0-9]+[ ]*(?:liter|litre)')
                        THEN CAST(CAST(REGEXP_EXTRACT(LOWER(PRODUCT_NAME), '([0-9]+)[ ]*(?:liter|litre)') AS INT64) * 1000 AS STRING) || 'ml'
                    WHEN REGEXP_CONTAINS(LOWER(PRODUCT_NAME), '[0-9]+[ ]*l[^a-z]')
                        THEN CAST(CAST(REGEXP_EXTRACT(LOWER(PRODUCT_NAME), '([0-9]+)[ ]*l[^a-z]') AS INT64) * 1000 AS STRING) || 'ml'
                    WHEN REGEXP_CONTAINS(LOWER(PRODUCT_NAME), '[0-9]+[ ]*l$')
                        THEN CAST(CAST(REGEXP_EXTRACT(LOWER(PRODUCT_NAME), '([0-9]+)[ ]*l$') AS INT64) * 1000 AS STRING) || 'ml'
                    ELSE REGEXP_REPLACE(REGEXP_EXTRACT(LOWER(PRODUCT_NAME), '[0-9]+[ ]*(?:ml|kg|g)'), '[ ]', '')
                END AS volume
            FROM `{RAW_TABLE}`
            WHERE SCRAPED_AT = (SELECT MAX(SCRAPED_AT) FROM `{RAW_TABLE}`)
        )
        SELECT DISTINCT
            a.SHOP_NAME    AS SHOP_NAME_1,
            a.PRODUCT_NAME AS PRODUCT_NAME_1,
            b.SHOP_NAME    AS SHOP_NAME_2,
            b.PRODUCT_NAME AS PRODUCT_NAME_2
        FROM products a
        JOIN products b
            ON a.volume = b.volume
           AND a.SHOP_NAME < b.SHOP_NAME
        ORDER BY a.SHOP_NAME, a.PRODUCT_NAME, b.SHOP_NAME
    """).result()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Checkpoint / resume
# ---------------------------------------------------------------------------

def load_done_pairs(path: str) -> set[tuple]:
    if not os.path.exists(path):
        return set()
    with open(path, newline="", encoding="utf-8") as f:
        return {(r["shop_name_1"], r["product_name_1"],
                 r["shop_name_2"], r["product_name_2"])
                for r in csv.DictReader(f)}


def open_csv_append(path: str) -> tuple:
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    f = open(path, "a", newline="", encoding="utf-8")
    w = csv.DictWriter(f, fieldnames=FIELDNAMES)
    if is_new:
        w.writeheader()
    return f, w


# ---------------------------------------------------------------------------
# Groq oracle — text only
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


def judge_pair(client: Groq, shop_a: str, name_a: str, shop_b: str, name_b: str) -> str:
    user_msg = (
        f"Product A — shop: {shop_a}\nName: {name_a}\n\n"
        f"Product B — shop: {shop_b}\nName: {name_b}\n\n"
        "Are these the same product SKU?"
    )
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
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

def run() -> None:
    bq_client      = bigquery.Client(project=GCP_PROJECT)
    client         = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    brand_keywords = load_brand_keywords(BRAND_LIST_PATH)

    log.info("Fetching cross-shop pairs from BigQuery…")
    all_pairs = fetch_pairs(bq_client)
    log.info("Total cross-shop pairs: %d", len(all_pairs))

    # Brand filter: keep only same-brand pairs
    if brand_keywords:
        same_brand_pairs = []
        skipped_diff_brand = 0
        skipped_unknown    = 0
        for p in all_pairs:
            b1 = detect_brand(p["PRODUCT_NAME_1"], brand_keywords)
            b2 = detect_brand(p["PRODUCT_NAME_2"], brand_keywords)
            if b1 == "UNKNOWN" or b2 == "UNKNOWN":
                skipped_unknown += 1
            elif b1 != b2:
                skipped_diff_brand += 1
            else:
                p["BRAND_1"] = b1
                p["BRAND_2"] = b2
                same_brand_pairs.append(p)
        log.info(
            "After brand filter → %d same-brand pairs  "
            "(skipped: %d different-brand, %d unknown-brand)",
            len(same_brand_pairs), skipped_diff_brand, skipped_unknown,
        )
        pairs_to_evaluate = same_brand_pairs
    else:
        # No brand list — fall back to all pairs
        for p in all_pairs:
            p["BRAND_1"] = ""
            p["BRAND_2"] = ""
        pairs_to_evaluate = all_pairs

    # Step 3 — Resume: skip already-processed pairs
    done = load_done_pairs(OUTPUT_PATH) | load_done_pairs(UNCERTAIN_PATH)
    pairs = [
        p for p in pairs_to_evaluate
        if (p["SHOP_NAME_1"], p["PRODUCT_NAME_1"],
            p["SHOP_NAME_2"], p["PRODUCT_NAME_2"]) not in done
    ]
    log.info("Already processed: %d  Remaining to evaluate: %d", len(done), len(pairs))

    if not pairs:
        log.info("All pairs already processed. Nothing to do.")
        return

    out_f, out_w = open_csv_append(OUTPUT_PATH)
    unc_f, unc_w = open_csv_append(UNCERTAIN_PATH)
    same = different = uncertain = 0

    try:
        for i, pair in enumerate(pairs, 1):
            shop_a = pair["SHOP_NAME_1"];  name_a = pair["PRODUCT_NAME_1"]
            shop_b = pair["SHOP_NAME_2"];  name_b = pair["PRODUCT_NAME_2"]
            brand  = pair.get("BRAND_1", "")

            log.info("[%d/%d] [%s] %s  ↔  [%s] %s",
                     i, len(pairs), shop_a, name_a, shop_b, name_b)

            verdict = judge_pair(client, shop_a, name_a, shop_b, name_b)
            log.info("  → %s", verdict)

            row = dict(shop_name_1=shop_a, product_name_1=name_a, brand_1=brand,
                       shop_name_2=shop_b, product_name_2=name_b, brand_2=brand,
                       verdict=verdict)
            if verdict == "UNCERTAIN":
                unc_w.writerow(row);  unc_f.flush();  uncertain += 1
            else:
                out_w.writerow(row);  out_f.flush()
                if verdict == "SAME": same += 1
                else: different += 1

            time.sleep(RATE_LIMIT_DELAY)

    finally:
        out_f.close()
        unc_f.close()

    log.info("Done.  SAME=%d  DIFFERENT=%d  UNCERTAIN=%d", same, different, uncertain)
    total_done = len(done) + same + different + uncertain
    log.info("Progress: %d / %d same-brand pairs labelled", total_done, len(pairs_to_evaluate))
    if total_done < len(pairs_to_evaluate):
        log.info("Re-run tomorrow to continue — already-done pairs are skipped automatically.")
    else:
        log.info("All done! Run evaluate_matching.py to get Precision / Recall / F1.")


if __name__ == "__main__":
    run()
