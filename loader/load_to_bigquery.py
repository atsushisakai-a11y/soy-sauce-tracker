"""
Load scraper CSV output into BigQuery soy-sauce-tracker.raw.raw_kikkoman_prices.
Every run always inserts new rows — no deduplication.

Usage:
    pip install google-cloud-bigquery python-dotenv
    python loader/load_to_bigquery.py <path/to/csv>
"""

import csv
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GCP_PROJECT = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
TABLE_ID    = f"{GCP_PROJECT}.raw.raw_kikkoman_prices"


def get_client():
    return bigquery.Client(project=GCP_PROJECT)


def ensure_table(client: bigquery.Client) -> None:
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{TABLE_ID}` (
            SCRAPE_RUN_ID  STRING,
            SHOP_NAME      STRING,
            PRODUCT_NAME   STRING,
            RAW_PRICE      STRING,
            CURRENCY       STRING,
            PRODUCT_URL    STRING,
            IMAGE_URL      STRING,
            SCRAPED_AT     TIMESTAMP,
            _LOADED_AT     TIMESTAMP
        )
    """).result()


def load(csv_path: str) -> int:
    loaded_at = datetime.now(timezone.utc).isoformat()

    with open(csv_path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    if not rows:
        print("CSV is empty — nothing to load.")
        return 0

    client = get_client()
    ensure_table(client)

    bq_rows = [
        {
            "SCRAPE_RUN_ID": r["scrape_run_id"],
            "SHOP_NAME":     r["shop_name"],
            "PRODUCT_NAME":  r["product_name"],
            "RAW_PRICE":     r["raw_price"],
            "CURRENCY":      r["currency"],
            "PRODUCT_URL":   r["product_url"],
            "IMAGE_URL":     r.get("image_url", ""),
            "SCRAPED_AT":    r["scraped_at"],
            "_LOADED_AT":    loaded_at,
        }
        for r in rows
    ]

    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )
    client.load_table_from_json(bq_rows, TABLE_ID, job_config=job_config).result()

    print(f"Inserted {len(bq_rows)} rows into {TABLE_ID}")
    print(f"Scrape run ID: {bq_rows[0]['SCRAPE_RUN_ID']}")
    return len(bq_rows)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python load_to_bigquery.py <path/to/csv>")
        sys.exit(1)
    load(sys.argv[1])
