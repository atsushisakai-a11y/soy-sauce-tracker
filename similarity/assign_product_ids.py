"""
Assign global_product_id to matched product groups across shops.
# trigger: 2026-05-31

Flow:
  1. Read all IS_MATCH=TRUE pairs from STAGING.STAGING_SIMILARITY_SCORES
  2. Read manual overrides from manual_matches.csv (for products the
     text/image matcher can't catch, e.g. completely different naming)
  3. Read all distinct (shop_name, product_name) from STAGING.STAGING_PRICES
  4. Run union-find to cluster matched products into connected components
  5. Assign a deterministic UUID5 to each component (keyed on its lexicographic root)
     — singletons (no match) get their own UUID, guaranteed unique and stable
  6. Full-refresh STAGING.STAGING_PRODUCT_GROUPS with the mapping

Why union-find?
  If A matches B and B matches C, all three belong to one group even though
  A↔C may never have been compared directly.  Union-find resolves these
  transitive chains in a single pass.

Why UUID5 (deterministic)?
  The same (shop_name, product_name) group always produces the same UUID,
  so downstream tables remain stable between reruns even when only new
  scrape dates are added.
"""

import csv
import logging
import os
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from google.cloud import bigquery

MANUAL_MATCHES_PATH = os.path.join(os.path.dirname(__file__), "manual_matches.csv")

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Stable namespace for UUID5 generation (RFC 4122 URL namespace)
_UUID_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


# ---------------------------------------------------------------------------
# Union-Find
# ---------------------------------------------------------------------------

class UnionFind:
    def __init__(self):
        self.parent: dict[str, str] = {}

    def add(self, x: str) -> None:
        if x not in self.parent:
            self.parent[x] = x

    def find(self, x: str) -> str:
        """Path-compressed find."""
        if x not in self.parent:
            self.parent[x] = x
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # halving
            x = self.parent[x]
        return x

    def union(self, x: str, y: str) -> None:
        """Union by smaller string key (deterministic root selection)."""
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if rx < ry:
            self.parent[ry] = rx
        else:
            self.parent[rx] = ry

    def components(self) -> dict[str, list[str]]:
        """Map root → list of member nodes."""
        groups: dict[str, list[str]] = {}
        for node in self.parent:
            root = self.find(node)
            groups.setdefault(root, []).append(node)
        return groups


# ---------------------------------------------------------------------------
# BigQuery helpers
# ---------------------------------------------------------------------------

GCP_PROJECT       = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
TABLE_ID          = f"{GCP_PROJECT}.staging.staging_product_groups"
SIMILARITY_TABLE  = f"{GCP_PROJECT}.staging.staging_similarity_scores"
PRICES_TABLE      = f"{GCP_PROJECT}.staging.staging_prices"


def get_client():
    return bigquery.Client(project=GCP_PROJECT)


def load_manual_matches(path: str = MANUAL_MATCHES_PATH) -> list[tuple]:
    """Read manual_matches.csv and emit (shop1, name1, shop2, name2) pairs —
    one pair per consecutive row within each `group`, so an N-row group
    chains into a single connected component via union-find."""
    if not os.path.exists(path):
        return []

    groups: dict[str, list[tuple]] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            groups.setdefault(row["group"], []).append((row["shop_name"], row["product_name"]))

    pairs = []
    for members in groups.values():
        for i in range(1, len(members)):
            shop1, name1 = members[0]
            shop2, name2 = members[i]
            pairs.append((shop1, name1, shop2, name2))
    return pairs


def ensure_table(client: bigquery.Client) -> None:
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{TABLE_ID}` (
            SHOP_NAME         STRING,
            PRODUCT_NAME      STRING,
            GLOBAL_PRODUCT_ID STRING,
            COMPUTED_AT       TIMESTAMP
        )
    """).result()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run() -> None:
    client = get_client()

    ensure_table(client)

    # 1. All IS_MATCH=TRUE pairs from staging_similarity_scores
    result = client.query(f"""
        SELECT DISTINCT SHOP_NAME_1, PRODUCT_NAME_1, SHOP_NAME_2, PRODUCT_NAME_2
        FROM `{SIMILARITY_TABLE}`
        WHERE IS_MATCH = TRUE
    """).result()
    match_pairs: list[tuple] = [tuple(row) for row in result]
    log.info("Loaded %d IS_MATCH=TRUE pairs.", len(match_pairs))

    manual_pairs = load_manual_matches()
    log.info("Loaded %d manual override pairs.", len(manual_pairs))
    match_pairs.extend(manual_pairs)

    if not match_pairs:
        log.info("No matched pairs — staging_product_groups will be empty.")
        client.query(f"TRUNCATE TABLE `{TABLE_ID}`").result()
        return

    # 2. Union-Find — only over matched products.
    #    Unmatched (singleton) products are intentionally excluded; staging_prices.sql
    #    falls back to product_id via COALESCE when the LEFT JOIN finds no row.
    uf = UnionFind()

    for shop1, name1, shop2, name2 in match_pairs:
        node1, node2 = f"{shop1}||{name1}", f"{shop2}||{name2}"
        uf.add(node1)
        uf.add(node2)
        uf.union(node1, node2)
        log.info("  Matched: [%s] %s  ↔  [%s] %s", shop1, name1, shop2, name2)

    # 3. Build mapping: one row per matched product → shared global_product_id
    computed_at = datetime.now(ZoneInfo("Europe/Amsterdam")).strftime("%Y-%m-%d %H:%M:%S")
    bq_rows: list[dict] = []

    for node in uf.parent:
        shop, name = node.split("||", 1)
        root = uf.find(node)
        global_product_id = str(uuid.uuid5(_UUID_NS, root))
        bq_rows.append({
            "SHOP_NAME":         shop,
            "PRODUCT_NAME":      name,
            "GLOBAL_PRODUCT_ID": global_product_id,
            "COMPUTED_AT":       computed_at,
        })

    # 5. Full refresh
    client.query(f"TRUNCATE TABLE `{TABLE_ID}`").result()
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )
    client.load_table_from_json(bq_rows, TABLE_ID, job_config=job_config).result()
    log.info("Wrote %d rows to staging_product_groups.", len(bq_rows))

    # 6. Summary — log multi-product groups (cross-shop matches)
    groups = uf.components()
    matched_groups = {r: nodes for r, nodes in groups.items() if len(nodes) > 1}
    log.info("Found %d multi-product groups (matched across shops):", len(matched_groups))
    for root, nodes in sorted(matched_groups.items()):
        gid = str(uuid.uuid5(_UUID_NS, root))
        log.info("  global_product_id=%s", gid)
        for node in sorted(nodes):
            shop, name = node.split("||", 1)
            log.info("    [%s] %s", shop, name)


if __name__ == "__main__":
    run()
