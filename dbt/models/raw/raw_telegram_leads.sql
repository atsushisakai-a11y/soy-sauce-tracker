-- DDL: create the raw_telegram_leads table in BigQuery
-- Run this once manually in the BigQuery console before starting Soy Bot.
-- This file is kept here for reference alongside the other raw layer definitions.
--
-- Project : soy-sauce-tracker
-- Dataset : raw
-- Table   : raw_telegram_leads

CREATE TABLE IF NOT EXISTS `soy-sauce-tracker.raw.raw_telegram_leads` (
  -- ── Identity ──────────────────────────────────────────────────────────────
  telegram_user_id   INT64    NOT NULL,
  first_name         STRING,
  username           STRING,
  email              STRING,

  -- ── Conversation answers ──────────────────────────────────────────────────
  reason             STRING,   -- summary of why user is interested
  ai_reply           STRING,   -- last bot message in conversation
  fav_brand          STRING,   -- Q2: favourite soy sauce brand
  dishes             STRING,   -- Q3: dishes cooked with soy sauce
  origin_country     STRING,   -- Q4: user's country of origin
  market_outlook     STRING,   -- Q5: opinion on European market expansion

  -- ── Propensity scoring ────────────────────────────────────────────────────
  propensity_score   FLOAT64,  -- 0-100 likelihood to buy soy sauce
  score_breakdown    STRING,   -- JSON: {dimension: {score, reason}}

  -- ── Metadata ─────────────────────────────────────────────────────────────
  created_at         DATETIME NOT NULL,
  deleted_at         DATETIME
)
OPTIONS (
  description = "Telegram lead sign-ups collected by Soy Bot, with propensity scores",
  labels = [("env", "production")]
);

-- ── ALTER TABLE: add new columns to existing table ───────────────────────────
-- Run this if the table already exists without the new columns.
-- Executed: 2026-06-09
ALTER TABLE `soy-sauce-tracker.raw.raw_telegram_leads`
  ADD COLUMN IF NOT EXISTS fav_brand        STRING,
  ADD COLUMN IF NOT EXISTS dishes           STRING,
  ADD COLUMN IF NOT EXISTS origin_country   STRING,
  ADD COLUMN IF NOT EXISTS market_outlook   STRING,
  ADD COLUMN IF NOT EXISTS propensity_score FLOAT64,
  ADD COLUMN IF NOT EXISTS score_breakdown  STRING;
