"""
Assign global_product_id to matched product groups across shops.
# trigger: 2026-05-31

Flow:
  1. Read all IS_MATCH=TRUE pairs from STAGING.STAGING_SIMILARITY_SCORES
  2. Read all distinct (shop_name, product_name) from STAGING.STAGING_PRICES
  3. Run union-find to cluster matched products into connected components
  4. Assign a deterministic UUID5 to each component (keyed on its lexicographic root)
     — singletons (no match) get their own UUID, guaranteed unique and stable
  5. Full-refresh STAGING.STAGING_PRODUCT_GROUPS with the mapping

Why union-find?
  If A matches B and B matches C, all three belong to one group even though
  A↔C may never have been compared directly.  Union-find resolves these
  transitive chains in a single pass.

Why UUID5 (deterministic)?
  The same (shop_name, product_name) group always produces the same UUID,
  so downstream tables remain stable between reruns even when only new
  scrape dates are added.
"""

import logging
import os
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import snowflake.connector
from dotenv import load_dotenv

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
# Snowflake helpers
# ---------------------------------------------------------------------------

def get_conn():
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.environ.get("SNOWFLAKE_ROLE", ""),
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database="price_monitoring",
        schema="STAGING",
    )


def ensure_table(cur) -> None:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS STAGING_PRODUCT_GROUPS (
            SHOP_NAME         VARCHAR(255),
            PRODUCT_NAME      VARCHAR(500),
            GLOBAL_PRODUCT_ID VARCHAR(36),
            COMPUTED_AT       TIMESTAMP_NTZ
        )
    """)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run() -> None:
    conn = get_conn()
    cur  = conn.cursor()

    ensure_table(cur)

    # 1. All IS_MATCH=TRUE pairs from STAGING_SIMILARITY_SCORES
    cur.execute("""
        SELECT DISTINCT SHOP_NAME_1, PRODUCT_NAME_1, SHOP_NAME_2, PRODUCT_NAME_2
        FROM STAGING_SIMILARITY_SCORES
        WHERE IS_MATCH = TRUE
    """)
    match_pairs: list[tuple] = cur.fetchall()
    log.info("Loaded %d IS_MATCH=TRUE pairs.", len(match_pairs))

    if not match_pairs:
        log.info("No matched pairs — STAGING_PRODUCT_GROUPS will be empty.")
        cur.execute("DELETE FROM STAGING_PRODUCT_GROUPS")
        conn.commit()
        cur.close()
        conn.close()
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
    insert_rows: list[tuple] = []

    for node in uf.parent:
        shop, name = node.split("||", 1)
        root = uf.find(node)
        global_product_id = str(uuid.uuid5(_UUID_NS, root))
        insert_rows.append((shop, name, global_product_id, computed_at))

    # 5. Full refresh
    cur.execute("DELETE FROM STAGING_PRODUCT_GROUPS")
    cur.executemany("""
        INSERT INTO STAGING_PRODUCT_GROUPS
            (SHOP_NAME, PRODUCT_NAME, GLOBAL_PRODUCT_ID, COMPUTED_AT)
        VALUES (%s, %s, %s, %s)
    """, insert_rows)
    conn.commit()
    log.info("Wrote %d rows to STAGING_PRODUCT_GROUPS.", len(insert_rows))

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

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
