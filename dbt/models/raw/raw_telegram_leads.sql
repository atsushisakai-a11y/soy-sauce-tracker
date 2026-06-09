-- DDL: create the raw_telegram_leads table in BigQuery
-- Run this once manually in the BigQuery console before starting Soy Bot.
-- This file is kept here for reference alongside the other raw layer definitions.
--
-- Project : soy-sauce-tracker
-- Dataset : raw
-- Table   : raw_telegram_leads

CREATE TABLE IF NOT EXISTS `soy-sauce-tracker.raw.raw_telegram_leads` (
  telegram_user_id   INT64     NOT NULL,
  first_name         STRING,
  username           STRING,
  reason             STRING,
  ai_reply           STRING,
  email              STRING,
  created_at         TIMESTAMP NOT NULL,
  deleted_at         TIMESTAMP
)
OPTIONS (
  description = "Telegram lead sign-ups collected by Soy Bot",
  labels = [("env", "production")]
);
