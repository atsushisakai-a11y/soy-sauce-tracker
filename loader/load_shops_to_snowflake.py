"""
Load amsterdam_asian_shops.csv into Snowflake price_monitoring.raw.RAW_OSM_SHOPS.
Replaces all rows on every run (full refresh) — the shop list is a snapshot.

Usage:
    python load_shops_to_snowflake.py <path/to/amsterdam_asian_shops.csv>
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
    "SNOWFLAKE_SCHEMA",
]


def get_conn():
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f"Missing env vars: {', '.join(missing)}")

    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.environ.get("SNOWFLAKE_ROLE", ""),
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        schema=os.environ["SNOWFLAKE_SCHEMA"],
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

    cur.execute("""
        CREATE TABLE IF NOT EXISTS RAW_OSM_SHOPS (
            NAME        VARCHAR(500),
            ADDRESS     VARCHAR(1000),
            WEBSITE     VARCHAR(2000),
            PHONE       VARCHAR(100),
            CUISINE     VARCHAR(500),
            SHOP_TYPE   VARCHAR(100),
            OSM_ID      VARCHAR(50),
            OSM_TYPE    VARCHAR(50),
            _LOADED_AT  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)

    # Full refresh — delete all rows then re-insert
    cur.execute("DELETE FROM RAW_OSM_SHOPS")

    insert_sql = """
        INSERT INTO RAW_OSM_SHOPS
            (NAME, ADDRESS, WEBSITE, PHONE, CUISINE, SHOP_TYPE, OSM_ID, OSM_TYPE, _LOADED_AT)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    data = [
        (
            r["name"],
            r["address"],
            r["website"],
            r["phone"],
            r["cuisine"],
            r["shop_type"],
            r["osm_id"],
            r["osm_type"],
            loaded_at,
        )
        for r in rows
    ]

    cur.executemany(insert_sql, data)
    conn.commit()

    db = os.environ["SNOWFLAKE_DATABASE"]
    schema = os.environ["SNOWFLAKE_SCHEMA"]
    print(f"Inserted {len(data)} rows into {db}.{schema}.RAW_OSM_SHOPS")

    cur.close()
    conn.close()
    return len(data)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python load_shops_to_snowflake.py <path/to/amsterdam_asian_shops.csv>")
        sys.exit(1)
    load(sys.argv[1])
