"""
send_report.py — Send the exclusive PDF report to all active subscribers via Brevo.

Usage:
    python3 send_report.py --pdf path/to/report.pdf
    python3 send_report.py --pdf path/to/report.pdf --dry-run  # preview only, no emails sent

Requirements:
    - BREVO_API_KEY in .env
    - REPORT_FROM_EMAIL in .env  (e.g. "Soy Sauce Bot <atsushi_sakai1208@hotmail.com>")
    - REPORT_FROM_NAME in .env   (e.g. "Soy Sauce Bot")
    - Active subscribers in BigQuery raw.raw_telegram_leads
"""

import argparse
import base64
import json
import logging
import os
import sys
from email.utils import parseaddr
from pathlib import Path

from brevo.client import Brevo
from brevo.transactional_emails.types import (
    SendTransacEmailRequestAttachmentItem,
    SendTransacEmailRequestSender,
    SendTransacEmailRequestToItem,
)
from dotenv import load_dotenv
from google.cloud import bigquery
from google.oauth2 import service_account

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
BREVO_API_KEY = os.environ["BREVO_API_KEY"]
BQ_PROJECT    = os.getenv("BQ_PROJECT", "soy-sauce-tracker")
BQ_TABLE_FULL = f"{BQ_PROJECT}.raw.raw_telegram_leads"

# Parse "Soy Sauce Bot <email@example.com>" or plain "email@example.com"
_from_raw  = os.environ["REPORT_FROM_EMAIL"]
FROM_NAME, FROM_EMAIL = parseaddr(_from_raw)
if not FROM_EMAIL:
    FROM_EMAIL = _from_raw
if not FROM_NAME:
    FROM_NAME = os.getenv("REPORT_FROM_NAME", "Soy Sauce Bot")

# ── BigQuery client ───────────────────────────────────────────────────────────
_gcp_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if _gcp_json:
    _creds = service_account.Credentials.from_service_account_info(
        json.loads(_gcp_json),
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    bq = bigquery.Client(project=BQ_PROJECT, credentials=_creds)
else:
    bq = bigquery.Client(project=BQ_PROJECT)

# ── Brevo client ──────────────────────────────────────────────────────────────
brevo = Brevo(api_key=BREVO_API_KEY)


# ── Fetch active subscribers ──────────────────────────────────────────────────
def get_active_subscribers() -> list[dict]:
    query = f"""
        SELECT first_name, email
        FROM (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY telegram_user_id
                    ORDER BY created_at DESC
                ) AS row_num
            FROM `{BQ_TABLE_FULL}`
        )
        WHERE row_num = 1
          AND deleted_at IS NULL
          AND email IS NOT NULL
    """
    rows = list(bq.query(query).result())
    return [{"first_name": r.first_name or "there", "email": r.email} for r in rows]


# ── Send one email ────────────────────────────────────────────────────────────
def send_report_email(first_name: str, email: str, pdf_path: Path) -> None:
    pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode()

    brevo.transactional_emails.send_transac_email(
        sender=SendTransacEmailRequestSender(name=FROM_NAME, email=FROM_EMAIL),
        to=[SendTransacEmailRequestToItem(email=email, name=first_name)],
        subject="🫙 Your Exclusive European Soy Sauce Market Report",
        html_content=f"""
        <p>Hi {first_name},</p>
        <p>Your exclusive <strong>European Soy Sauce Market Report</strong> is attached! 🫙</p>
        <p>Inside you'll find:</p>
        <ul>
            <li>Monthly price trends across 10+ European shops</li>
            <li>Brand-level comparisons</li>
            <li>Country-by-country breakdowns</li>
        </ul>
        <p>
            You can also track live prices at
            <a href="https://kikkoman-price-tracker.vercel.app">the price tracker</a>.
        </p>
        <p>To unsubscribe, open Soy Bot on Telegram and type <code>/delete</code>.</p>
        <p>May your soy sauce always be perfectly priced. 🫙</p>
        <p><em>— {FROM_NAME}</em></p>
        """,
        attachment=[
            SendTransacEmailRequestAttachmentItem(
                name=pdf_path.name,
                content=pdf_b64,
            )
        ],
    )


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Send exclusive PDF report to all active subscribers"
    )
    parser.add_argument("--pdf",     required=True, help="Path to the PDF report file")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview recipients without sending emails")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        logger.error("PDF not found: %s", pdf_path)
        sys.exit(1)
    if pdf_path.suffix.lower() != ".pdf":
        logger.error("File must be a .pdf: %s", pdf_path)
        sys.exit(1)

    logger.info("Sender: %s <%s>", FROM_NAME, FROM_EMAIL)

    subscribers = get_active_subscribers()
    if not subscribers:
        logger.info("No active subscribers found. Nothing to send.")
        return

    logger.info("Found %d active subscriber(s):", len(subscribers))
    for s in subscribers:
        logger.info("  - %s <%s>", s["first_name"], s["email"])

    if args.dry_run:
        logger.info("Dry run — no emails sent.")
        return

    sent, failed = 0, 0
    for s in subscribers:
        try:
            send_report_email(s["first_name"], s["email"], pdf_path)
            logger.info("✅ Sent to %s", s["email"])
            sent += 1
        except Exception as exc:
            logger.error("❌ Failed to send to %s: %s", s["email"], exc)
            failed += 1

    logger.info("Done — %d sent, %d failed.", sent, failed)


if __name__ == "__main__":
    main()
