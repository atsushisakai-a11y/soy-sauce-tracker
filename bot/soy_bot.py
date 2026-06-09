"""
Soy Bot — Telegram bot for the European Soy Sauce Price Tracker.

Conversation flow:
  /start → greet user → ask why they're interested
  user answers → Claude Haiku funny reply → ask for email
  user provides email → save to BigQuery → done

  /delete → soft-delete the user's record in BigQuery
  /cancel → abort the current conversation flow

Run:
  pip install -r requirements.txt
  cp .env.example .env  # fill in your tokens
  python soy_bot.py
"""

import json
import logging
import os
import re
import tempfile
from collections import defaultdict
from datetime import date, datetime, timezone

from google import genai
from dotenv import load_dotenv
from google.cloud import bigquery
from google.oauth2 import service_account
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
BQ_PROJECT = os.getenv("BQ_PROJECT", "soy-sauce-tracker")
BQ_DATASET = os.getenv("BQ_DATASET", "raw")
BQ_TABLE = os.getenv("BQ_TABLE", "raw_telegram_leads")
BQ_TABLE_FULL = f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE}"

GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_DAILY_LIMIT = int(os.getenv("GEMINI_DAILY_LIMIT", "50"))  # max AI calls per day

# Simple in-memory daily counter (resets when bot restarts / at midnight)
_gemini_usage: dict[date, int] = defaultdict(int)

# ConversationHandler states
ASKING_REASON, ASKING_EMAIL = range(2)

# ── Clients ───────────────────────────────────────────────────────────────────
gemini = genai.Client(api_key=GEMINI_API_KEY)

GEMINI_SYSTEM_PROMPT = (
    "You are Soy Bot, a quirky and enthusiastic specialist of the European soy sauce market. "
    "Your personality is warm, slightly dramatic, and genuinely funny — think of a sommelier "
    "who takes soy sauce far too seriously. "
    "Keep your reply to 2-4 sentences. End with something that makes the person smile."
)

# BigQuery: use service account JSON from env var (cloud) or ADC (local)
_gcp_credentials_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if _gcp_credentials_json:
    _sa_info = json.loads(_gcp_credentials_json)
    _credentials = service_account.Credentials.from_service_account_info(
        _sa_info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    bq = bigquery.Client(project=BQ_PROJECT, credentials=_credentials)
    logger.info("BigQuery: using service account credentials from env var")
else:
    bq = bigquery.Client(project=BQ_PROJECT)
    logger.info("BigQuery: using Application Default Credentials")


# ── Helper: Gemini funny reply ────────────────────────────────────────────────
def generate_funny_reply(first_name: str, reason: str) -> str:
    """Ask Gemini Flash for a funny, warm reply. Returns None if daily limit reached."""
    today = date.today()
    if _gemini_usage[today] >= GEMINI_DAILY_LIMIT:
        logger.warning("Gemini daily limit (%d) reached — skipping AI call", GEMINI_DAILY_LIMIT)
        return None
    prompt = (
        f"The user's name is {first_name}. "
        f"They said they are interested in the soy sauce market report because: \"{reason}\". "
        "Write a funny, encouraging reply acknowledging their reason. "
        "Do NOT ask for their email yet — just respond warmly to what they said."
    )
    response = gemini.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=genai.types.GenerateContentConfig(system_instruction=GEMINI_SYSTEM_PROMPT),
    )
    _gemini_usage[today] += 1
    logger.info("Gemini usage today: %d/%d", _gemini_usage[today], GEMINI_DAILY_LIMIT)
    return response.text.strip()


# ── Helper: BigQuery insert ───────────────────────────────────────────────────
def save_lead(
    telegram_user_id: int,
    first_name: str | None,
    username: str | None,
    reason: str,
    ai_reply: str,
    email: str,
) -> None:
    row = {
        "telegram_user_id": telegram_user_id,
        "first_name": first_name,
        "username": username,
        "reason": reason,
        "ai_reply": ai_reply,
        "email": email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
    }
    errors = bq.insert_rows_json(BQ_TABLE_FULL, [row])
    if errors:
        raise RuntimeError(f"BigQuery insert errors: {errors}")
    logger.info("Saved lead for telegram_user_id=%s email=%s", telegram_user_id, email)


# ── Helper: BigQuery soft-delete ──────────────────────────────────────────────
def lookup_email(telegram_user_id: int) -> str | None:
    """Return the most recent email on record for this user, or None."""
    query = f"""
        SELECT email
        FROM `{BQ_TABLE_FULL}`
        WHERE telegram_user_id = @uid
          AND email IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("uid", "INT64", telegram_user_id)
        ]
    )
    rows = list(bq.query(query, job_config=job_config).result())
    return rows[0].email if rows else None


def soft_delete_lead(
    telegram_user_id: int,
    first_name: str | None = None,
    username: str | None = None,
) -> None:
    """Inserts a deletion-marker row for this user.

    BigQuery streaming inserts cannot be updated/deleted until they leave
    the streaming buffer (~90 min). Instead we insert a marker row with
    deleted_at set; queries treat the latest row per user as the truth.
    """
    email = lookup_email(telegram_user_id)
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "telegram_user_id": telegram_user_id,
        "first_name": first_name,
        "username": username,
        "reason": None,
        "ai_reply": None,
        "email": email,
        "created_at": now,
        "deleted_at": now,
    }
    errors = bq.insert_rows_json(BQ_TABLE_FULL, [row])
    if errors:
        raise RuntimeError(f"BigQuery insert errors: {errors}")
    logger.info("Inserted deletion marker for telegram_user_id=%s", telegram_user_id)


# ── /start ────────────────────────────────────────────────────────────────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    first_name = user.first_name or "there"

    greeting = (
        f"Hi {first_name}! 🫙\n\n"
        "My name is Soy Bot, a specialist of the European soy sauce market. "
        "I help serious soy sauce enthusiasts (and market researchers) stay ahead "
        "of pricing trends across the continent.\n\n"
        "I would love to send you our exclusive report — but first, "
        "*why are you interested in the European soy sauce market?* 🤔"
    )
    await update.message.reply_text(greeting, parse_mode="Markdown")
    return ASKING_REASON


# ── State: receive reason ─────────────────────────────────────────────────────
async def receive_reason(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    reason = update.message.text or ""

    # Store for later
    context.user_data["reason"] = reason

    # Generate funny AI reply
    await update.message.reply_text("One moment while I process this profound insight… 🧐")
    try:
        funny_reply = generate_funny_reply(user.first_name or "friend", reason)
        if funny_reply is None:
            funny_reply = (
                "That's a fascinating reason! The soy sauce market rewards the curious mind. 🫙✨"
            )
    except Exception as exc:
        logger.warning("Gemini API error: %s", exc)
        funny_reply = (
            "That's a fascinating reason! The soy sauce market rewards the curious mind. 🫙✨"
        )

    context.user_data["ai_reply"] = funny_reply

    await update.message.reply_text(funny_reply)
    await update.message.reply_text(
        "Now, to send you the exclusive report — what is your *email address*? 📧",
        parse_mode="Markdown",
    )
    return ASKING_EMAIL


# ── State: receive email ──────────────────────────────────────────────────────
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def receive_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    email = (update.message.text or "").strip()

    if not EMAIL_RE.match(email):
        await update.message.reply_text(
            "Hmm, that doesn't look like a valid email address. "
            "Please try again — something like `you@example.com`. 🫙",
            parse_mode="Markdown",
        )
        return ASKING_EMAIL

    user = update.effective_user
    reason = context.user_data.get("reason", "")
    ai_reply = context.user_data.get("ai_reply", "")

    try:
        save_lead(
            telegram_user_id=user.id,
            first_name=user.first_name,
            username=user.username,
            reason=reason,
            ai_reply=ai_reply,
            email=email,
        )
    except Exception as exc:
        logger.error("Failed to save lead: %s", exc, exc_info=True)
        await update.message.reply_text(
            f"Oops — something went wrong saving your details. 😅\n\n"
            f"Error: `{exc}`",
            parse_mode="Markdown",
        )
        return ConversationHandler.END

    await update.message.reply_text(
        f"🎉 You're all set, {user.first_name or 'friend'}!\n\n"
        f"I've noted your email as *{email}*. "
        "You'll receive the next exclusive European Soy Sauce Market Report "
        "straight in your inbox.\n\n"
        "In the meantime, keep an eye on prices at the tracker website. "
        "May your soy sauce always be perfectly priced. 🫙✨\n\n"
        "_Type /delete at any time to remove your registration._",
        parse_mode="Markdown",
    )
    context.user_data.clear()
    return ConversationHandler.END


# ── /cancel ───────────────────────────────────────────────────────────────────
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text(
        "No worries — registration cancelled. "
        "Type /start whenever you'd like to try again. 🫙"
    )
    return ConversationHandler.END


# ── /delete ───────────────────────────────────────────────────────────────────
async def delete_registration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    try:
        soft_delete_lead(user.id, first_name=user.first_name, username=user.username)
    except Exception as exc:
        logger.error("Failed to delete lead for user %s: %s", user.id, exc, exc_info=True)
        await update.message.reply_text(
            f"Something went wrong while trying to delete your data. 😔\n\nError: `{exc}`",
            parse_mode="Markdown",
        )
        return

    await update.message.reply_text(
        "✅ Done — your registration has been removed from our database.\n\n"
        "If you ever want to sign up again, just type /start. "
        "No hard feelings, soy sauce is a complicated world. 🫙"
    )


# ── /help ─────────────────────────────────────────────────────────────────────
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "*Soy Bot — Command Reference* 🫙\n\n"
        "/start — Sign up for the exclusive report\n"
        "/delete — Remove your registration and data\n"
        "/cancel — Cancel the current sign-up flow\n"
        "/help — Show this message",
        parse_mode="Markdown",
    )


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    app = Application.builder().token(TELEGRAM_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            ASKING_REASON: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_reason)
            ],
            ASKING_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_email)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(conv_handler)
    app.add_handler(CommandHandler("delete", delete_registration))
    app.add_handler(CommandHandler("help", help_command))

    logger.info("Soy Bot is running — polling for messages…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
