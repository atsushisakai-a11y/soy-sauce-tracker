"""
score_leads.py — Batch propensity scorer for Telegram leads.

Queries BigQuery for leads that are missing a propensity score,
scores each one using the Groq LLM, and writes results back.

Why this exists
---------------
The real-time scorer in soy_bot.py scores a lead the moment the user
submits their email. This batch script is a safety net for leads where
the real-time scoring failed (network error, API timeout, etc.), and
can also be used to re-score all leads when the model weights change.

Usage
-----
    # Score only leads missing a score (default)
    python score_leads.py

    # Re-score ALL active leads (overwrite existing scores)
    python score_leads.py --all

    # Dry-run: show what would be scored without writing anything
    python score_leads.py --dry-run

Triggered automatically by GitHub Actions as:
    "7. Score Leads - Propensity Model"
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from google.cloud import bigquery
from google.oauth2 import service_account

# scoring_model.py lives in ../bot/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bot"))
from scoring_model import ScoringResult, score_conversation

load_dotenv()

logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ["GROQ_API_KEY"]
BQ_PROJECT   = os.getenv("BQ_PROJECT",   "soy-sauce-tracker")
BQ_DATASET   = os.getenv("BQ_DATASET",   "raw")
BQ_TABLE     = os.getenv("BQ_TABLE",     "raw_telegram_leads")
TABLE_FULL   = f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE}"
CET          = ZoneInfo("Europe/Amsterdam")


# ── BigQuery client ───────────────────────────────────────────────────────────
def _bq_client() -> bigquery.Client:
    gcp_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if gcp_json:
        info = json.loads(gcp_json)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        return bigquery.Client(project=BQ_PROJECT, credentials=creds)
    return bigquery.Client(project=BQ_PROJECT)


# ── Fetch leads to score ──────────────────────────────────────────────────────
def fetch_leads(bq: bigquery.Client, score_all: bool) -> list[dict]:
    """Return leads that need scoring.

    score_all=False  → only rows where propensity_score IS NULL
    score_all=True   → all active (non-deleted) leads
    """
    where = "deleted_at IS NULL"
    if not score_all:
        where += " AND propensity_score IS NULL"

    # Get the most recent row per user (latest-row-per-user pattern)
    query = f"""
        WITH ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (
                       PARTITION BY telegram_user_id
                       ORDER BY created_at DESC
                   ) AS rn
            FROM `{TABLE_FULL}`
        )
        SELECT *
        FROM ranked
        WHERE rn = 1
          AND {where}
          AND email IS NOT NULL
        ORDER BY created_at ASC
    """
    rows = list(bq.query(query).result())
    return [dict(r) for r in rows]


# ── Build conversation history from stored data ───────────────────────────────
def build_history(lead: dict) -> list[dict]:
    """Reconstruct a conversation history for scoring.

    Priority:
    1. conversation_json column  — full history stored by soy_bot.py (best)
    2. Fallback                  — synthesise from reason / extracted fields
    """
    raw_json = lead.get("conversation_json")
    if raw_json:
        try:
            history = json.loads(raw_json)
            if isinstance(history, list) and history:
                return history
        except (json.JSONDecodeError, TypeError):
            logger.warning("Could not parse conversation_json for user %s — using fallback",
                           lead["telegram_user_id"])

    # Fallback: synthesise from stored fields
    parts = []
    if lead.get("reason"):
        # reason = first 3 user turns joined with " / "
        for turn in str(lead["reason"]).split(" / "):
            if turn.strip():
                parts.append({"role": "user", "text": turn.strip()})
    if lead.get("fav_brand") and lead["fav_brand"] != "Not mentioned":
        parts.append({"role": "user", "text": f"My favourite soy sauce is {lead['fav_brand']}."})
    if lead.get("dishes") and lead["dishes"] != "Not mentioned":
        parts.append({"role": "user", "text": f"I use soy sauce in: {lead['dishes']}."})
    if lead.get("origin_country") and lead["origin_country"] != "Not mentioned":
        parts.append({"role": "user", "text": f"I am originally from {lead['origin_country']}."})
    if lead.get("market_outlook") and lead["market_outlook"] != "Not mentioned":
        parts.append({"role": "user", "text": f"My view on the European soy market: {lead['market_outlook']}."})

    return parts if parts else [{"role": "user", "text": "Interested in soy sauce."}]


# ── Write scores back to BigQuery ─────────────────────────────────────────────
def write_scores(bq: bigquery.Client, lead: dict, result: ScoringResult) -> None:
    """UPDATE the lead row with scoring results using BigQuery DML."""
    now_cet = datetime.now(CET).strftime("%Y-%m-%d %H:%M:%S.%f")

    query = f"""
        UPDATE `{TABLE_FULL}`
        SET
            propensity_score = @propensity_score,
            score_breakdown  = @score_breakdown,
            fav_brand        = COALESCE(fav_brand,      @fav_brand),
            dishes           = COALESCE(dishes,          @dishes),
            origin_country   = COALESCE(origin_country, @origin_country),
            market_outlook   = COALESCE(market_outlook,  @market_outlook)
        WHERE telegram_user_id = @uid
          AND created_at = @created_at
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("propensity_score", "FLOAT64",  result.propensity_score),
            bigquery.ScalarQueryParameter("score_breakdown",  "STRING",   result.breakdown_json()),
            bigquery.ScalarQueryParameter("fav_brand",        "STRING",   result.fav_brand),
            bigquery.ScalarQueryParameter("dishes",           "STRING",   result.dishes),
            bigquery.ScalarQueryParameter("origin_country",   "STRING",   result.origin_country),
            bigquery.ScalarQueryParameter("market_outlook",   "STRING",   result.market_outlook),
            bigquery.ScalarQueryParameter("uid",              "INT64",    lead["telegram_user_id"]),
            bigquery.ScalarQueryParameter("created_at",       "DATETIME", str(lead["created_at"])),
        ]
    )
    bq.query(query, job_config=job_config).result()


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Batch propensity scorer for soy sauce leads")
    parser.add_argument("--all",     action="store_true", help="Re-score ALL active leads")
    parser.add_argument("--dry-run", action="store_true", help="Score but do not write to BigQuery")
    args = parser.parse_args()

    bq = _bq_client()
    leads = fetch_leads(bq, score_all=args.all)

    if not leads:
        logger.info("No leads to score. All done. ✅")
        return

    logger.info("Found %d lead(s) to score%s.",
                len(leads), " (dry-run)" if args.dry_run else "")

    scored = 0
    failed = 0

    for lead in leads:
        uid   = lead["telegram_user_id"]
        name  = lead.get("first_name") or "unknown"
        email = lead.get("email") or ""

        history = build_history(lead)
        source  = "conversation_json" if lead.get("conversation_json") else "fallback fields"
        logger.info("Scoring user %s (%s / %s) — history source: %s, turns: %d",
                    uid, name, email, source, len(history))

        try:
            result = score_conversation(history, GROQ_API_KEY)
            logger.info(
                "  → %.1f / 100  %s  |  brand: %s  |  country: %s",
                result.propensity_score, result.label,
                result.fav_brand, result.origin_country,
            )

            if not args.dry_run:
                write_scores(bq, lead, result)
                logger.info("  → Written to BigQuery ✅")
            else:
                logger.info("  → Dry-run: skipping write")

            scored += 1

        except Exception as exc:
            logger.error("  → FAILED for user %s: %s", uid, exc, exc_info=True)
            failed += 1

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print(f"  Batch scoring complete")
    print(f"  Scored : {scored}")
    print(f"  Failed : {failed}")
    if args.dry_run:
        print("  Mode   : DRY-RUN (no writes)")
    print("=" * 50 + "\n")

    if failed:
        sys.exit(1)   # non-zero exit → GitHub Actions marks step as failed


if __name__ == "__main__":
    main()
