"""
Import validated ground truth (columns A–I) from CSV
→ BigQuery staging.staging_prices_ground_truth_validated.

The CSV is stored in the repo at similarity/ground_truth_validated.csv.
Update it by replacing that file and re-running this script (or the GitHub Action).

Usage:
    python3 similarity/import_ground_truth_validated.py
    python3 similarity/import_ground_truth_validated.py ~/Downloads/validated.csv
"""

import csv
import logging
import os
import sys

from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
TABLE       = f"{GCP_PROJECT}.staging.staging_prices_ground_truth_validated"


def load_csv(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # Keep only the first 9 columns (A–I)
        cols = reader.fieldnames[:9]
        log.info("Columns A–I: %s", cols)
        return [{k: row[k] for k in cols} for row in reader]


def normalise_keys(rows: list[dict]) -> list[dict]:
    """Lowercase + strip column names so BigQuery schema is consistent."""
    return [
        {k.lower().strip().replace(" ", "_"): (v.strip() if v else None)
         for k, v in row.items()}
        for row in rows
    ]


def infer_schema(row: dict) -> list[bigquery.SchemaField]:
    return [bigquery.SchemaField(k, "STRING") for k in row.keys()]


def ensure_table(client: bigquery.Client, schema: list[bigquery.SchemaField]) -> None:
    table_ref = bigquery.Table(TABLE, schema=schema)
    client.create_table(table_ref, exists_ok=True)
    log.info("Table %s is ready.", TABLE)


def run(csv_path: str) -> None:
    client = bigquery.Client(project=GCP_PROJECT)

    raw = load_csv(csv_path)
    if not raw:
        log.info("CSV is empty.")
        return

    rows = normalise_keys(raw)
    log.info("Rows to import: %d", len(rows))

    schema = infer_schema(rows[0])
    ensure_table(client, schema)

    # Truncate first so re-running is idempotent
    client.query(f"TRUNCATE TABLE `{TABLE}`").result()

    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        errors = client.insert_rows_json(TABLE, batch)
        if errors:
            log.error("Insert errors (batch %d): %s", i // 500, errors)
        else:
            log.info("Inserted %d rows", len(batch))

    log.info("Done. %d rows imported to %s", len(rows), TABLE)


DEFAULT_CSV = os.path.join(os.path.dirname(__file__), "ground_truth_validated.csv")

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) == 2 else DEFAULT_CSV
    if not os.path.exists(path):
        print(f"CSV not found: {path}")
        print(f"Usage: python3 {sys.argv[0]} [path/to/csv]")
        sys.exit(1)
    run(path)
