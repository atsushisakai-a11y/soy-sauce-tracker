"""
Load amsterdam_asian_shops.csv into BigQuery soy-sauce-tracker.raw.raw_osm_shops.
Full refresh on every run — the shop list is a snapshot.

Usage:
    pip install google-cloud-bigquery python-dotenv
    python loader/load_shops_to_bigquery.py <path/to/amsterdam_asian_shops.csv>
"""

import csv
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GCP_PROJECT = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
TABLE_ID    = f"{GCP_PROJECT}.raw.raw_osm_shops"


def get_client():
    return bigquery.Client(project=GCP_PROJECT)


def ensure_table(client: bigquery.Client) -> None:
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{TABLE_ID}` (
            NAME        STRING,
            ADDRESS     STRING,
            WEBSITE     STRING,
            PHONE       STRING,
            CUISINE     STRING,
            SHOP_TYPE   STRING,
            OSM_ID      STRING,
            OSM_TYPE    STRING,
            _LOADED_AT  TIMESTAMP
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

    # Full refresh
    client.query(f"TRUNCATE TABLE `{TABLE_ID}`").result()

    bq_rows = [
        {
            "NAME":      r["name"],
            "ADDRESS":   r["address"],
            "WEBSITE":   r["website"],
            "PHONE":     r["phone"],
            "CUISINE":   r["cuisine"],
            "SHOP_TYPE": r["shop_type"],
            "OSM_ID":    r["osm_id"],
            "OSM_TYPE":  r["osm_type"],
            "_LOADED_AT": loaded_at,
        }
        for r in rows
    ]

    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )
    client.load_table_from_json(bq_rows, TABLE_ID, job_config=job_config).result()

    print(f"Inserted {len(bq_rows)} rows into {TABLE_ID}")
    return len(bq_rows)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python load_shops_to_bigquery.py <path/to/amsterdam_asian_shops.csv>")
        sys.exit(1)
    load(sys.argv[1])
