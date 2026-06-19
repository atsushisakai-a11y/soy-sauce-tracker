"""
Step 1 — Generate brand_list.csv using Groq (text only, one-time run).

Queries all distinct product names from BigQuery and asks Llama to extract
the brand/manufacturer name from each. Output is committed to the repo and
reused by generate_ground_truth.py to filter pairs to same-brand only.

Why AI for brand extraction?
  Product names across shops are inconsistent: "Kikkoman Soy Sauce 150ml",
  "KIKKOMAN SOY SAUCE TAFELFLES 150 ML", "Shouyu (Kikkoman) 1L" all refer to
  the same brand. A static regex list misses these variations. Llama normalises
  them to a canonical uppercase brand name reliably.

This script supports resume: product names already in brand_list.csv are skipped.

Usage:
    pip install groq google-cloud-bigquery python-dotenv
    GROQ_API_KEY=<key> python similarity/generate_brand_list.py
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

GCP_PROJECT   = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
RAW_TABLE     = f"{GCP_PROJECT}.raw.raw_products"
GROQ_MODEL    = "meta-llama/llama-4-scout-17b-16e-instruct"
OUTPUT_PATH   = os.path.join(os.path.dirname(__file__), "brand_list.csv")
FIELDNAMES    = ["product_name", "brand"]
RATE_LIMIT_DELAY = 2.1


# ---------------------------------------------------------------------------
# BigQuery
# ---------------------------------------------------------------------------

def fetch_product_names(client: bigquery.Client) -> list[str]:
    """Return all distinct product names from the latest scrape."""
    rows = client.query(f"""
        SELECT DISTINCT PRODUCT_NAME
        FROM `{RAW_TABLE}`
        WHERE SCRAPE_DATE = (SELECT MAX(SCRAPE_DATE) FROM `{RAW_TABLE}`)
          AND PRODUCT_NAME IS NOT NULL
        ORDER BY PRODUCT_NAME
    """).result()
    return [row["PRODUCT_NAME"] for row in rows]


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------

def load_done_names(path: str) -> set[str]:
    if not os.path.exists(path):
        return set()
    with open(path, newline="", encoding="utf-8") as f:
        return {row["product_name"] for row in csv.DictReader(f)}


def open_csv_append(path: str) -> tuple:
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    f = open(path, "a", newline="", encoding="utf-8")
    w = csv.DictWriter(f, fieldnames=FIELDNAMES)
    if is_new:
        w.writeheader()
    return f, w


# ---------------------------------------------------------------------------
# Groq brand extraction
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Extract the brand or manufacturer name from the product name provided.
Reply with ONLY the brand name in uppercase English.
If you cannot determine the brand, reply with UNKNOWN.
No explanation. No punctuation. Just the brand name."""


def extract_brand(client: Groq, product_name: str) -> str:
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": product_name},
        ],
        max_tokens=20,
    )
    return response.choices[0].message.content.strip().upper()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run() -> None:
    bq_client = bigquery.Client(project=GCP_PROJECT)
    client    = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    log.info("Fetching distinct product names from BigQuery…")
    all_names = fetch_product_names(bq_client)
    log.info("Total distinct products: %d", len(all_names))

    done  = load_done_names(OUTPUT_PATH)
    names = [n for n in all_names if n not in done]
    log.info("Already labelled: %d  Remaining: %d", len(done), len(names))

    if not names:
        log.info("All products already labelled. Nothing to do.")
        return

    f, w = open_csv_append(OUTPUT_PATH)
    try:
        for i, name in enumerate(names, 1):
            log.info("[%d/%d] %s", i, len(names), name)
            brand = extract_brand(client, name)
            log.info("  → %s", brand)
            w.writerow({"product_name": name, "brand": brand})
            f.flush()
            time.sleep(RATE_LIMIT_DELAY)
    finally:
        f.close()

    total = len(done) + len(names)
    log.info("Done. %d products labelled → %s", total, OUTPUT_PATH)
    log.info("Commit brand_list.csv to the repo, then run generate_ground_truth.py")


if __name__ == "__main__":
    run()
