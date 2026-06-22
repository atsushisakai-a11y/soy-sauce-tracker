"""
Generate ground truth labels using Groq (Llama 4 Scout) — same-brand pairs only.

Writes results to BigQuery `staging.staging_prices_ground_truth` instead of CSV files.
Resume/checkpoint: pairs already in that table are skipped on re-run.

Optimization vs naive all-pairs approach:
  Naive: 4,520 cross-shop pairs → exhausts Groq free-tier token budget in one run.
  Optimised: filter to same-brand same-volume pairs first → ~7.5% of all pairs.
  Brand and volume filtering is done entirely in BigQuery SQL.

Usage:
    pip install groq google-cloud-bigquery python-dotenv
    GROQ_API_KEY=<key> python similarity/generate_ground_truth.py
"""

import logging
import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from google.cloud import bigquery
from groq import Groq

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
RAW_TABLE   = f"{GCP_PROJECT}.raw.raw_kikkoman_prices"
GT_TABLE    = f"{GCP_PROJECT}.staging.staging_prices_ground_truth"
GROQ_MODEL  = "meta-llama/llama-4-scout-17b-16e-instruct"

RATE_LIMIT_DELAY = 2.1


# ---------------------------------------------------------------------------
# BigQuery
# ---------------------------------------------------------------------------

def ensure_gt_table(client: bigquery.Client) -> None:
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{GT_TABLE}` (
            shop_name_1    STRING,
            product_name_1 STRING,
            product_url_1  STRING,
            brand          STRING,
            shop_name_2    STRING,
            product_name_2 STRING,
            product_url_2  STRING,
            verdict        STRING,
            labelled_at    TIMESTAMP
        )
    """).result()


def fetch_pairs(client: bigquery.Client) -> list[dict]:
    """Return distinct cross-shop same-brand same-volume pairs from the latest scrape."""
    rows = client.query(f"""
        WITH products AS (
            SELECT
                SHOP_NAME,
                PRODUCT_NAME,
                PRODUCT_URL,
                CASE
                    WHEN LOWER(PRODUCT_NAME) LIKE '%kikkoman%'        THEN 'KIKKOMAN'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%lee kum kee%'     THEN 'LEE KUM KEE'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%pearl river bridge%' THEN 'PEARL RIVER BRIDGE'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%mee chun%'        THEN 'MEE CHUN'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%healthy boy%'     THEN 'HEALTHY BOY'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%yamasa%'          THEN 'YAMASA'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%sempio%'          THEN 'SEMPIO'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%silver swan%'     THEN 'SILVER SWAN'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%dek som boon%'    THEN 'DEK SOM BOON'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%marukin%'         THEN 'MARUKIN'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%abc%'             THEN 'ABC'
                    WHEN LOWER(PRODUCT_NAME) LIKE '%hb %'             THEN 'HEALTHY BOY'
                    ELSE 'UNKNOWN'
                END AS brand,
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
            a.PRODUCT_URL  AS PRODUCT_URL_1,
            a.brand        AS BRAND,
            b.SHOP_NAME    AS SHOP_NAME_2,
            b.PRODUCT_NAME AS PRODUCT_NAME_2,
            b.PRODUCT_URL  AS PRODUCT_URL_2
        FROM products a
        JOIN products b
            ON a.brand  = b.brand
           AND a.volume = b.volume
           AND a.SHOP_NAME < b.SHOP_NAME
        WHERE a.brand != 'UNKNOWN'
        ORDER BY a.SHOP_NAME, a.PRODUCT_NAME, b.SHOP_NAME
    """).result()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Checkpoint / resume
# ---------------------------------------------------------------------------

def load_done_pairs(client: bigquery.Client) -> set[tuple]:
    """Return pairs already in the ground truth table to skip on re-run."""
    try:
        rows = client.query(f"""
            SELECT shop_name_1, product_name_1, shop_name_2, product_name_2
            FROM `{GT_TABLE}`
        """).result()
        return {(r["shop_name_1"], r["product_name_1"],
                 r["shop_name_2"], r["product_name_2"])
                for r in rows}
    except Exception:
        return set()


def insert_row(client: bigquery.Client, row: dict) -> None:
    errors = client.insert_rows_json(GT_TABLE, [row])
    if errors:
        log.error("BigQuery insert error: %s", errors)


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
    bq_client   = bigquery.Client(project=GCP_PROJECT)
    groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    ensure_gt_table(bq_client)

    log.info("Fetching cross-shop pairs from BigQuery…")
    pairs_to_evaluate = fetch_pairs(bq_client)
    log.info("Same-brand same-volume pairs to evaluate: %d", len(pairs_to_evaluate))

    done = load_done_pairs(bq_client)
    pairs = [
        p for p in pairs_to_evaluate
        if (p["SHOP_NAME_1"], p["PRODUCT_NAME_1"],
            p["SHOP_NAME_2"], p["PRODUCT_NAME_2"]) not in done
    ]
    log.info("Already processed: %d  Remaining to evaluate: %d", len(done), len(pairs))

    if not pairs:
        log.info("All pairs already processed. Nothing to do.")
        return

    same = different = uncertain = 0

    for i, pair in enumerate(pairs, 1):
        shop_a = pair["SHOP_NAME_1"];  name_a = pair["PRODUCT_NAME_1"];  url_a = pair["PRODUCT_URL_1"]
        shop_b = pair["SHOP_NAME_2"];  name_b = pair["PRODUCT_NAME_2"];  url_b = pair["PRODUCT_URL_2"]
        brand  = pair["BRAND"]

        log.info("[%d/%d] [%s] %s  ↔  [%s] %s",
                 i, len(pairs), shop_a, name_a, shop_b, name_b)

        try:
            verdict = judge_pair(groq_client, shop_a, name_a, shop_b, name_b)
        except Exception as e:
            if "rate_limit_exceeded" in str(e) or "429" in str(e):
                log.warning("Groq daily request limit reached. Progress saved — re-run tomorrow.")
                break
            raise
        log.info("  → %s", verdict)

        insert_row(bq_client, {
            "shop_name_1":    shop_a,
            "product_name_1": name_a,
            "product_url_1":  url_a,
            "brand":          brand,
            "shop_name_2":    shop_b,
            "product_name_2": name_b,
            "product_url_2":  url_b,
            "verdict":        verdict,
            "labelled_at":    datetime.now(timezone.utc).isoformat(),
        })
        if verdict == "SAME":        same += 1
        elif verdict == "DIFFERENT": different += 1
        else:                        uncertain += 1

        time.sleep(RATE_LIMIT_DELAY)

    log.info("Done.  SAME=%d  DIFFERENT=%d  UNCERTAIN=%d", same, different, uncertain)
    total_done = len(done) + same + different + uncertain
    log.info("Progress: %d / %d same-brand pairs labelled", total_done, len(pairs_to_evaluate))
    if total_done < len(pairs_to_evaluate):
        log.info("Re-run tomorrow to continue — already-done pairs are skipped automatically.")
    else:
        log.info("All done! Run evaluate_matching.py to get Precision / Recall / F1.")


if __name__ == "__main__":
    run()
