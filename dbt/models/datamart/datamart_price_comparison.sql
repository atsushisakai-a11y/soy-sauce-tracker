{{ config(materialized='view') }}

/*
  Datamart — dm_price_comparison
  --------------------------------
  Final price comparison view for the Kikkoman proposal.
  Joins fact_price with dim_price to produce a full comparison per shop per run.

  Key metrics:
    - price_rank          : 1 = cheapest shop in this snapshot
    - pct_vs_avg          : % above (positive) or below (negative) market average
    - premium_vs_cheapest : absolute EUR gap vs the cheapest shop
    - price_position      : Cheapest / At Market / Above Market / Below Market
    - suggested_price_eur : market average rounded to nearest €0.05
*/

WITH fact AS (
    SELECT * FROM {{ ref('fact_price') }}
),

dim AS (
    SELECT * FROM {{ ref('dim_price') }}
)

SELECT
    -- Identity
    f.scrape_run_id,
    f.shop_name,
    d.brand,
    d.product_variant,
    d.volume_ml,
    f.scrape_date,

    -- Pricing
    f.price_eur,
    f.price_per_100ml_eur,

    -- Market benchmarks
    f.shop_count,
    f.min_price_eur,
    f.max_price_eur,
    f.avg_price_eur,
    f.median_price_eur,

    -- Relative positioning
    f.price_rank,
    f.premium_vs_cheapest_eur,
    f.pct_vs_avg,

    -- Categorical label
    CASE
        WHEN f.price_rank = 1                    THEN 'Cheapest'
        WHEN f.pct_vs_avg BETWEEN -5.0 AND 5.0   THEN 'At Market'
        WHEN f.pct_vs_avg > 5.0                  THEN 'Above Market'
        ELSE                                          'Below Market'
    END                                              AS price_position,

    -- Reference price for Kikkoman proposal (market avg rounded to €0.05)
    ROUND(f.avg_price_eur / 0.05) * 0.05            AS suggested_price_eur,

    -- Traceability
    d.product_url,
    f.scraped_at

FROM fact f
LEFT JOIN dim d ON f.price_dim_key = d.price_dim_key
ORDER BY f.scrape_date DESC, f.price_rank ASC
