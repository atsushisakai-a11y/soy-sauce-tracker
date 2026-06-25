"""
Create staging.staging_similarity_scores_evaluated by joining:
  - staging.staging_similarity_scores  (IS_MATCH from DINOv2 pipeline)
  - staging.staging_prices_ground_truth_validated  (human-verified verdict)

Only ground truth rows where Groq verdict == manual_check are used
(i.e. both oracle and human agree — the most trustworthy labels).

The resulting table adds `ground_truth_verdict` to every similarity score row
so Precision / Recall / F1 can be computed against IS_MATCH.

Usage:
    python3 similarity/evaluate_similarity.py
"""

import logging
import os

from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

GCP_PROJECT   = os.environ.get("GCP_PROJECT", "soy-sauce-tracker")
SCORES_TABLE  = f"{GCP_PROJECT}.staging.staging_similarity_scores"
GT_TABLE      = f"{GCP_PROJECT}.staging.staging_prices_ground_truth_validated"
OUTPUT_TABLE  = f"{GCP_PROJECT}.staging.staging_similarity_scores_evaluated"


def run() -> None:
    client = bigquery.Client(project=GCP_PROJECT)

    # Build evaluated table: similarity scores + ground truth verdict
    # Pair ordering may differ between tables so both directions are checked.
    # Only ground truth rows where Groq and human agree are used (verdict = manual_check).
    sql = f"""
        CREATE OR REPLACE TABLE `{OUTPUT_TABLE}` AS
        SELECT
            ss.SIMILARITY_ID,
            ss.SCRAPE_DATE,
            ss.SHOP_NAME_1,
            ss.SHOP_NAME_2,
            ss.PRODUCT_NAME_1,
            ss.PRODUCT_NAME_2,
            ss.IMAGE_URL_1,
            ss.IMAGE_URL_2,
            ss.IMAGE_SIMILARITY,
            ss.NAME_SIMILARITY,
            ss.COMBINED_SCORE,
            ss.IS_MATCH,
            ss.COMPUTED_AT,
            gt.verdict AS ground_truth_verdict
        FROM `{SCORES_TABLE}` ss
        LEFT JOIN (
            SELECT *
            FROM `{GT_TABLE}`
            WHERE UPPER(verdict) = UPPER(manual_check)
        ) gt
        ON (
            (ss.SHOP_NAME_1    = gt.shop_name_1
             AND ss.PRODUCT_NAME_1 = gt.product_name_1
             AND ss.SHOP_NAME_2    = gt.shop_name_2
             AND ss.PRODUCT_NAME_2 = gt.product_name_2)
            OR
            (ss.SHOP_NAME_1    = gt.shop_name_2
             AND ss.PRODUCT_NAME_1 = gt.product_name_2
             AND ss.SHOP_NAME_2    = gt.shop_name_1
             AND ss.PRODUCT_NAME_2 = gt.product_name_1)
        )
    """

    log.info("Creating %s…", OUTPUT_TABLE)
    client.query(sql).result()
    log.info("Table created.")

    # Summary stats — count all rows first, then compute metrics on matched subset
    stats = client.query(f"""
        SELECT
            COUNT(*)                                                     AS total_pairs,
            COUNTIF(ground_truth_verdict IS NOT NULL)                    AS matched_with_ground_truth,
            COUNTIF(ground_truth_verdict IS NULL)                        AS not_in_ground_truth,
            COUNTIF(IS_MATCH     AND ground_truth_verdict = 'SAME')      AS true_positive,
            COUNTIF(IS_MATCH     AND ground_truth_verdict = 'DIFFERENT') AS false_positive,
            COUNTIF(NOT IS_MATCH AND ground_truth_verdict = 'SAME')      AS false_negative,
            COUNTIF(NOT IS_MATCH AND ground_truth_verdict = 'DIFFERENT') AS true_negative
        FROM `{OUTPUT_TABLE}`
    """).result()

    for row in stats:
        tp      = row["true_positive"]
        fp      = row["false_positive"]
        fn      = row["false_negative"]
        tn      = row["true_negative"]
        total   = row["total_pairs"]
        matched = row["matched_with_ground_truth"]

        if total == 0:
            log.warning("staging_similarity_scores is empty — run step 3 (Compute Image Similarity) first.")
            return
        if matched == 0:
            log.warning("No similarity score rows matched the ground truth table — check that product names align.")
            log.info("Total similarity pairs in table: %d", total)
            return

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        accuracy  = (tp + tn) / matched if matched > 0 else 0

        log.info("─" * 50)
        log.info("Total similarity pairs : %d", total)
        log.info("Matched with GT        : %d  (%.1f%%)", matched, matched / total * 100)
        log.info("Not in ground truth    : %d", row["not_in_ground_truth"])
        log.info("─" * 50)
        log.info("True  Positive (SAME,   IS_MATCH=True)  : %d", tp)
        log.info("False Positive (DIFF,   IS_MATCH=True)  : %d", fp)
        log.info("False Negative (SAME,   IS_MATCH=False) : %d", fn)
        log.info("True  Negative (DIFF,   IS_MATCH=False) : %d", tn)
        log.info("─" * 50)
        log.info("Precision : %.3f", precision)
        log.info("Recall    : %.3f", recall)
        log.info("F1        : %.3f", f1)
        log.info("Accuracy  : %.3f", accuracy)


if __name__ == "__main__":
    run()
