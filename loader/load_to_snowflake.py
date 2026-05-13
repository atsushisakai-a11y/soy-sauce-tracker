"""
Load scraper CSV output into Snowflake RAW.KIKKOMAN_PRICES_RAW.

Usage:
    pip install snowflake-connector-python python-dotenv
    python load_to_snowflake.py output/kikkoman_prices_<timestamp>.csv
"""

import csv
import os
import sys
from datetime import datetime, timezone

import snowflake.connector
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

REQUIRED_ENV = [
    "SNOWFLAKE_ACCOUNT",
    "SNOWFLAKE_USER",
    "SNOWFLAKE_PASSWORD",
    "SNOWFLAKE_WAREHOUSE",
    "SNOWFLAKE_DATABASE",
    "SNOWFLAKE_RAW_SCHEMA",
]


def get_conn():
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f"Missing env vars: {', '.join(missing)}")

    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        schema=os.environ["SNOWFLAKE_RAW_SCHEMA"],
    )


def load(csv_path: str) -> int:
    loaded_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with open(csv_path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    if not rows:
        print("CSV is empty — nothing to load.")
        return 0

    conn = get_conn()
    cur = conn.cursor()

    insert_sql = """
        INSERT INTO KIKKOMAN_PRICES_RAW
            (SHOP_NAME, PRODUCT_NAME, RAW_PRICE, CURRENCY, PRODUCT_URL, SCRAPED_AT, _LOADED_AT)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """

    data = [
        (
            r["shop_name"],
            r["product_name"],
            r["raw_price"],
            r["currency"],
            r["product_url"],
            r["scraped_at"],
            loaded_at,
        )
        for r in rows
    ]

    cur.executemany(insert_sql, data)
    conn.commit()
    cur.close()
    conn.close()

    print(f"Loaded {len(data)} rows into RAW.KIKKOMAN_PRICES_RAW")
    return len(data)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python load_to_snowflake.py <path/to/csv>")
        sys.exit(1)
    load(sys.argv[1])
