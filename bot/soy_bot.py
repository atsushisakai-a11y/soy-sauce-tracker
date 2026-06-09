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

import base64
import json
import logging
import os
import re
import tempfile
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from brevo.client import Brevo as BrevoClient
from brevo.transactional_emails.types import (
    SendTransacEmailRequestAttachmentItem,
    SendTransacEmailRequestSender,
    SendTransacEmailRequestToItem,
)
from groq import Groq
from dotenv import load_dotenv
from scoring_model import score_conversation
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
GROQ_API_KEY   = os.environ["GROQ_API_KEY"]
BQ_PROJECT = os.getenv("BQ_PROJECT", "soy-sauce-tracker")
BQ_DATASET = os.getenv("BQ_DATASET", "raw")
BQ_TABLE = os.getenv("BQ_TABLE", "raw_telegram_leads")
BQ_TABLE_FULL = f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE}"

GROQ_MODEL     = "llama-3.3-70b-versatile"
SYSTEM_PROMPT  = """You are Soy Bot, a quirky and enthusiastic specialist of the \
European soy sauce market. Your personality is warm, witty, and genuinely funny — \
think of a passionate sommelier who takes soy sauce far too seriously.

You are having a free-flowing conversation with someone interested in your exclusive \
European Soy Sauce Market Report. During the conversation you must naturally cover \
these five topics — weave them in based on the flow, NOT as a rigid list:

  1. What brings them to the European soy sauce world?
  2. Their favourite soy sauce brand (and why)
  3. Dishes they cook that use soy sauce
  4. Where they are originally from
  5. Whether they think the soy sauce market will expand in Europe

Rules:
- Ask each topic naturally based on what the user just said. Never fire multiple \
  questions at once.
- React to their answers with a short funny comment before asking the next question.
- Once ALL five topics have been covered AND you have had at least 4 exchanges, \
  smoothly ask for their email so you can send the report. End that message with \
  the exact marker: [ASK_EMAIL]
- Keep replies concise: 2-4 sentences max.
- Never reveal you are an AI. You are Soy Bot."""
BREVO_API_KEY  = os.getenv("BREVO_API_KEY", "")
_from_raw      = os.getenv("REPORT_FROM_EMAIL", "")
FROM_NAME, FROM_EMAIL = __import__("email.utils", fromlist=["parseaddr"]).parseaddr(_from_raw)
if not FROM_EMAIL:
    FROM_EMAIL = _from_raw
if not FROM_NAME:
    FROM_NAME = os.getenv("REPORT_FROM_NAME", "Soy Sauce Bot")
PDF_PATH = Path(__file__).parent / "european_soy_sauce_market_report.pdf"
CET = ZoneInfo("Europe/Amsterdam")


def now_cet() -> str:
    """Current datetime in CET/CEST as a BigQuery DATETIME string."""
    return datetime.now(CET).strftime("%Y-%m-%d %H:%M:%S.%f")
GROQ_DAILY_LIMIT  = int(os.getenv("GROQ_DAILY_LIMIT",  "200"))  # max AI calls per day
GROQ_TURN_LIMIT   = int(os.getenv("GROQ_TURN_LIMIT",   "10"))   # max turns per conversation

# Simple in-memory daily counter (resets when bot restarts / at midnight)
_groq_usage: dict[date, int] = defaultdict(int)

# ConversationHandler states
CHATTING, ASKING_EMAIL, CONFIRMING_DELETE_EMAIL = range(3)

# ── Clients ───────────────────────────────────────────────────────────────────
groq_client = Groq(api_key=GROQ_API_KEY)

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


# ── Helper: Groq multi-turn chat ─────────────────────────────────────────────
def chat_with_groq(history: list[dict], user_message: str) -> tuple[str, bool]:
    """Send a message to Groq with full conversation history.

    Returns (reply_text, ask_email_now).
    ask_email_now is True when the model included [ASK_EMAIL] in its reply.
    """
    today = date.today()
    if _groq_usage[today] >= GROQ_DAILY_LIMIT:
        logger.warning("Groq daily limit (%d) reached", GROQ_DAILY_LIMIT)
        return ("The soy sauce data streams are temporarily overloaded! "
                "Try again in a bit. 🫙", False)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["text"]})
    messages.append({"role": "user", "content": user_message})

    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=300,
    )
    _groq_usage[today] += 1
    logger.info("Groq usage today: %d/%d", _groq_usage[today], GROQ_DAILY_LIMIT)

    reply = response.choices[0].message.content.strip()
    ask_email = "[ASK_EMAIL]" in reply
    reply = reply.replace("[ASK_EMAIL]", "").strip()
    return reply, ask_email


# ── Helper: BigQuery insert ───────────────────────────────────────────────────
def save_lead(
    telegram_user_id: int,
    first_name: str | None,
    username: str | None,
    reason: str,
    ai_reply: str,
    email: str,
    fav_brand: str | None = None,
    dishes: str | None = None,
    origin_country: str | None = None,
    market_outlook: str | None = None,
    propensity_score: float | None = None,
    score_breakdown: str | None = None,
) -> None:
    row = {
        "telegram_user_id": telegram_user_id,
        "first_name": first_name,
        "username": username,
        "reason": reason,
        "ai_reply": ai_reply,
        "email": email,
        "fav_brand": fav_brand,
        "dishes": dishes,
        "origin_country": origin_country,
        "market_outlook": market_outlook,
        "propensity_score": propensity_score,
        "score_breakdown": score_breakdown,
        "created_at": now_cet(),
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
    now = now_cet()
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

    context.user_data["history"] = []
    context.user_data["turn_count"] = 0

    greeting = (
        f"Hi {first_name}! 🫙\n\n"
        "My name is Soy Bot, a specialist of the European soy sauce market. "
        "I help soy sauce enthusiasts and market researchers stay ahead of pricing "
        "trends across Europe.\n\n"
        "So — what brings you to the world of European soy sauce? 🤔"
    )
    await update.message.reply_text(greeting)
    return CHATTING


# ── State: free chat with Gemini ──────────────────────────────────────────────
async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user_message = update.message.text or ""
    history: list = context.user_data.setdefault("history", [])
    turn_count = context.user_data.get("turn_count", 0)

    # Hard cap on turns per conversation
    if turn_count >= GROQ_TURN_LIMIT:
        await update.message.reply_text(
            "We've had quite the soy sauce journey together! 🫙\n"
            "Let's wrap up — what's your *email address* so I can send you the report?",
            parse_mode="Markdown",
        )
        return ASKING_EMAIL

    try:
        reply, ask_email_now = chat_with_groq(history, user_message)
    except Exception as exc:
        logger.error("Gemini error: %s", exc, exc_info=True)
        reply = f"Gemini error: {exc}"
        ask_email_now = False

    # Store turn in history
    history.append({"role": "user",      "text": user_message})
    history.append({"role": "assistant", "text": reply})
    context.user_data["turn_count"] = context.user_data.get("turn_count", 0) + 1

    await update.message.reply_text(reply)

    if ask_email_now:
        await update.message.reply_text(
            "📧 What is your email address?",
        )
        return ASKING_EMAIL

    return CHATTING


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

    history  = context.user_data.get("history", [])
    user_turns = [t["text"] for t in history if t["role"] == "user"]
    reason   = " / ".join(user_turns[:3]) if user_turns else ""
    ai_reply = history[-1]["text"] if history else ""

    # ── Score the conversation ──────────────────────────────────────────────
    fav_brand = dishes = origin_country = market_outlook = None
    propensity_score = score_breakdown = None
    try:
        result = score_conversation(history, GROQ_API_KEY)
        fav_brand        = result.fav_brand
        dishes           = result.dishes
        origin_country   = result.origin_country
        market_outlook   = result.market_outlook
        propensity_score = result.propensity_score
        score_breakdown  = result.breakdown_json()
        logger.info("Propensity score for %s: %.1f (%s)", user.id, propensity_score, result.label)
    except Exception as exc:
        logger.error("Scoring failed for user %s: %s", user.id, exc, exc_info=True)

    try:
        save_lead(
            telegram_user_id=user.id,
            first_name=user.first_name,
            username=user.username,
            reason=reason,
            ai_reply=ai_reply,
            email=email,
            fav_brand=fav_brand,
            dishes=dishes,
            origin_country=origin_country,
            market_outlook=market_outlook,
            propensity_score=propensity_score,
            score_breakdown=score_breakdown,
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


# ── /delete — step 1: ask for email ──────────────────────────────────────────
async def delete_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "To confirm deletion, please enter the *email address* you registered with. 📧",
        parse_mode="Markdown",
    )
    return CONFIRMING_DELETE_EMAIL


# ── /delete — step 2: verify email and delete ────────────────────────────────
async def delete_confirm_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    email = (update.message.text or "").strip()

    if not EMAIL_RE.match(email):
        await update.message.reply_text(
            "That doesn't look like a valid email. Please try again. 🫙",
        )
        return CONFIRMING_DELETE_EMAIL

    # Check if this email exists for this user
    try:
        existing_email = lookup_email(user.id)
    except Exception as exc:
        logger.error("Failed to look up email for user %s: %s", user.id, exc, exc_info=True)
        await update.message.reply_text(
            f"Something went wrong. 😔\n\nError: `{exc}`",
            parse_mode="Markdown",
        )
        return ConversationHandler.END

    if existing_email is None or existing_email.lower() != email.lower():
        await update.message.reply_text(
            "❌ That email doesn't match our records. "
            "Please check and try again, or type /cancel to abort."
        )
        return CONFIRMING_DELETE_EMAIL

    # Email matches — insert deletion marker
    try:
        soft_delete_lead(user.id, first_name=user.first_name, username=user.username)
    except Exception as exc:
        logger.error("Failed to delete lead for user %s: %s", user.id, exc, exc_info=True)
        await update.message.reply_text(
            f"Something went wrong while deleting your data. 😔\n\nError: `{exc}`",
            parse_mode="Markdown",
        )
        return ConversationHandler.END

    await update.message.reply_text(
        "✅ Done — your registration has been removed from our database.\n\n"
        "If you ever want to sign up again, just type /start. "
        "No hard feelings, soy sauce is a complicated world. 🫙"
    )
    return ConversationHandler.END


# ── /sendreport ───────────────────────────────────────────────────────────────
async def send_report_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user

    # Check PDF exists
    if not PDF_PATH.exists():
        await update.message.reply_text("Sorry, the report PDF is not available yet. 😔")
        return

    # Look up registered email
    try:
        email = lookup_email(user.id)
    except Exception as exc:
        logger.error("Failed to look up email: %s", exc, exc_info=True)
        await update.message.reply_text("Something went wrong looking up your email. 😔")
        return

    if not email:
        await update.message.reply_text(
            "You don't have a registered email yet.\n"
            "Type /start to sign up first! 🫙"
        )
        return

    await update.message.reply_text(f"Sending the report to *{email}*… 📧", parse_mode="Markdown")

    try:
        pdf_b64 = base64.b64encode(PDF_PATH.read_bytes()).decode()
        brevo_client = BrevoClient(api_key=BREVO_API_KEY)
        brevo_client.transactional_emails.send_transac_email(
            sender=SendTransacEmailRequestSender(name=FROM_NAME, email=FROM_EMAIL),
            to=[SendTransacEmailRequestToItem(email=email, name=user.first_name or "")],
            subject="🫙 Your Exclusive European Soy Sauce Market Report",
            html_content=f"""
            <p>Hi {user.first_name or "there"},</p>
            <p>Your exclusive <strong>European Soy Sauce Market Report</strong> is attached! 🫙</p>
            <p>Track live prices at <a href="https://soy-sauce-tracker-s3eo.vercel.app">the tracker</a>.</p>
            <p>To unsubscribe type <code>/delete</code> in Soy Bot on Telegram.</p>
            <p><em>— {FROM_NAME}</em></p>
            """,
            attachment=[SendTransacEmailRequestAttachmentItem(
                name=PDF_PATH.name, content=pdf_b64
            )],
        )
        await update.message.reply_text(
            f"✅ Report sent to *{email}*! Check your inbox. 🫙",
            parse_mode="Markdown",
        )
        logger.info("Report sent to %s (user %s)", email, user.id)
    except Exception as exc:
        logger.error("Failed to send report to %s: %s", email, exc, exc_info=True)
        await update.message.reply_text(
            f"Failed to send the email. 😔\n\nError: `{exc}`",
            parse_mode="Markdown",
        )


# ── /help ─────────────────────────────────────────────────────────────────────
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "*Soy Bot — Command Reference* 🫙\n\n"
        "/start — Sign up for the exclusive report\n"
        "/sendreport — Email the latest PDF report to your registered address\n"
        "/delete — Remove your registration and data\n"
        "/cancel — Cancel the current flow\n"
        "/help — Show this message",
        parse_mode="Markdown",
    )


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    app = Application.builder().token(TELEGRAM_TOKEN).build()

    signup_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            CHATTING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_chat)
            ],
            ASKING_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_email)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    delete_handler = ConversationHandler(
        entry_points=[CommandHandler("delete", delete_start)],
        states={
            CONFIRMING_DELETE_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, delete_confirm_email)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(signup_handler)
    app.add_handler(delete_handler)
    app.add_handler(CommandHandler("sendreport", send_report_command))
    app.add_handler(CommandHandler("help", help_command))

    logger.info("Soy Bot is running — polling for messages…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
