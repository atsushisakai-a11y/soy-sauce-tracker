"""
Generate ground_truth.csv using Groq (Llama 4 Scout) as an independent text oracle.

Why text-only (no images)?
  Vision calls consume ~55,000 tokens each on Groq's free tier (500K tokens/day limit),
  which allows only ~9 pairs per day. Text-only calls use ~180 tokens each (~2,700/day).
  Product names already carry brand, volume, and product type — sufficient for most pairs.

Resume/checkpoint support:
  Pairs already written to ground_truth.csv or ground_truth_uncertain.csv are skipped
  on re-run. Run the workflow on consecutive days to cover all pairs incrementally.

Flow:
  1. Read all distinct cross-shop pairs from STAGING.STAGING_SIMILARITY_SCORES
     (most recent scrape date only)
  2. Skip pairs already processed in existing output CSVs (checkpoint/resume)
  3. For each remaining pair, ask Llama 4 Scout via Groq for a SAME/DIFFERENT/UNCERTAIN verdict
  4. Append results to ground_truth.csv (SAME + DIFFERENT) and ground_truth_uncertain.csv

Usage:
    pip install groq google-cloud-bigquery python-dotenv requests
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

GCP_PROJECT      = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
SIMILARITY_TABLE = f"{GCP_PROJECT}.staging.staging_similarity_scores"
GROQ_MODEL       = "meta-llama/llama-4-scout-17b-16e-instruct"

OUTPUT_PATH    = os.path.join(os.path.dirname(__file__), "ground_truth.csv")
UNCERTAIN_PATH = os.path.join(os.path.dirname(__file__), "ground_truth_uncertain.csv")

FIELDNAMES = ["shop_name_1", "product_name_1", "shop_name_2", "product_name_2", "verdict"]

# Groq free tier: 500K tokens/day. Text-only calls use ~180 tokens each → ~2,700 pairs/day.
# Use a 2s delay to stay well under 30 RPM.
RATE_LIMIT_DELAY = 2.1


# ---------------------------------------------------------------------------
# BigQuery
# ---------------------------------------------------------------------------

def get_bq_client() -> bigquery.Client:
    return bigquery.Client(project=GCP_PROJECT)


def fetch_pairs(client: bigquery.Client) -> list[dict]:
    """Return distinct cross-shop pairs from the most recent scrape date only."""
    rows = client.query(f"""
        SELECT DISTINCT
            SHOP_NAME_1, PRODUCT_NAME_1,
            SHOP_NAME_2, PRODUCT_NAME_2
        FROM `{SIMILARITY_TABLE}`
        WHERE SCRAPE_DATE = (SELECT MAX(SCRAPE_DATE) FROM `{SIMILARITY_TABLE}`)
          AND SHOP_NAME_1 != SHOP_NAME_2
        ORDER BY SHOP_NAME_1, PRODUCT_NAME_1, SHOP_NAME_2
    """).result()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Checkpoint / resume
# ---------------------------------------------------------------------------

def load_done_pairs(path: str) -> set[tuple]:
    """Return set of (shop1, name1, shop2, name2) already written to path."""
    done: set[tuple] = set()
    if not os.path.exists(path):
        return done
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            done.add((row["shop_name_1"], row["product_name_1"],
                      row["shop_name_2"], row["product_name_2"]))
    return done


def open_csv_append(path: str) -> tuple[object, object]:
    """Open CSV for appending; write header only if file is new/empty."""
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    f = open(path, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    if is_new:
        writer.writeheader()
    return f, writer


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
    """Ask Llama 4 Scout whether two product names refer to the same SKU."""
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
    bq_client = get_bq_client()
    client    = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    log.info("Fetching cross-shop pairs from BigQuery…")
    all_pairs = fetch_pairs(bq_client)
    log.info("Total pairs in dataset: %d", len(all_pairs))

    # Resume: skip pairs already processed
    done = load_done_pairs(OUTPUT_PATH) | load_done_pairs(UNCERTAIN_PATH)
    pairs = [
        p for p in all_pairs
        if (p["SHOP_NAME_1"], p["PRODUCT_NAME_1"],
            p["SHOP_NAME_2"], p["PRODUCT_NAME_2"]) not in done
    ]
    log.info("Already processed: %d  Remaining: %d", len(done), len(pairs))

    if not pairs:
        log.info("All pairs already processed. Nothing to do.")
        return

    out_f,  out_w  = open_csv_append(OUTPUT_PATH)
    unc_f,  unc_w  = open_csv_append(UNCERTAIN_PATH)

    same = different = uncertain = 0

    try:
        for i, pair in enumerate(pairs, 1):
            shop_a = pair["SHOP_NAME_1"];  name_a = pair["PRODUCT_NAME_1"]
            shop_b = pair["SHOP_NAME_2"];  name_b = pair["PRODUCT_NAME_2"]

            log.info("[%d/%d] [%s] %s  ↔  [%s] %s", i, len(pairs), shop_a, name_a, shop_b, name_b)

            verdict = judge_pair(client, shop_a, name_a, shop_b, name_b)
            log.info("  → %s", verdict)

            row = dict(shop_name_1=shop_a, product_name_1=name_a,
                       shop_name_2=shop_b, product_name_2=name_b, verdict=verdict)
            if verdict == "UNCERTAIN":
                unc_w.writerow(row)
                unc_f.flush()
                uncertain += 1
            else:
                out_w.writerow(row)
                out_f.flush()
                if verdict == "SAME":
                    same += 1
                else:
                    different += 1

            time.sleep(RATE_LIMIT_DELAY)

    finally:
        out_f.close()
        unc_f.close()

    log.info("Done.  SAME=%d  DIFFERENT=%d  UNCERTAIN=%d", same, different, uncertain)
    log.info("Ground truth  → %s", OUTPUT_PATH)
    log.info("Manual review → %s", UNCERTAIN_PATH)
    log.info("")
    total_done = len(done) + same + different + uncertain
    log.info("Overall progress: %d / %d pairs labelled", total_done, len(all_pairs))
    if total_done < len(all_pairs):
        log.info("Re-run the workflow tomorrow to continue — already-done pairs will be skipped.")
    else:
        log.info("All pairs labelled! Run evaluate_matching.py to get Precision / Recall / F1.")


if __name__ == "__main__":
    run()
