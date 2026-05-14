{{ config(materialized='view') }}

/*
  Datamart — dm_price_comparison
  --------------------------------
  One row per shop per scrape date, enriched with market benchmarks.

  Key metrics for the Kikkoman proposal:
    - price_rank          : 1 = cheapest shop in this snapshot
    - pct_vs_avg          : how far above/below market average (%)
    - premium_vs_cheapest : absolute EUR gap vs the cheapest shop
    - price_position      : categorical label (Cheapest / At Market / Above Market)
    - suggested_price_eur : a reference price Kikkoman can use in negotiations
                            (set to market average rounded to nearest 5c)
*/

WITH silver AS (
    SELECT * FROM {{ ref('staging_kikkoman_prices') }}
),

gold AS (
    SELECT * FROM {{ ref('gold_price_summary') }}
),

joined AS (

    SELECT
        s.shop_name,
        s.brand,
        s.product_variant,
        s.volume_ml,
        s.price_eur,
        s.price_per_100ml_eur,
        s.product_url,
        DATE(s.scraped_at)                                                  AS scrape_date,
        s.scraped_at,

        -- Market benchmarks from gold
        g.shop_count,
        g.min_price_eur,
        g.max_price_eur,
        g.avg_price_eur,
        g.median_price_eur,
        g.price_spread_pct,
        g.avg_price_per_100ml,

        -- Gap vs cheapest (EUR)
        ROUND(s.price_eur - g.min_price_eur, 2)                            AS premium_vs_cheapest_eur,

        -- % vs market average  (negative = below avg = cheaper)
        ROUND((s.price_eur - g.avg_price_eur) / g.avg_price_eur * 100, 2) AS pct_vs_avg,

        -- % vs cheapest
        ROUND((s.price_eur - g.min_price_eur) / g.min_price_eur * 100, 2) AS pct_vs_cheapest,

        -- Price rank within this snapshot (1 = cheapest)
        RANK() OVER (
            PARTITION BY s.brand, s.product_variant, s.volume_ml, DATE(s.scraped_at)
            ORDER BY s.price_eur ASC
        )                                                                   AS price_rank,

        -- Suggested reference price for Kikkoman (market avg rounded to nearest €0.05)
        ROUND(g.avg_price_eur / 0.05) * 0.05                               AS suggested_price_eur

    FROM silver s
    LEFT JOIN gold g
        ON  s.brand            = g.brand
        AND s.product_variant  = g.product_variant
        AND s.volume_ml        = g.volume_ml
        AND DATE(s.scraped_at) = g.scrape_date

)

SELECT
    -- Identity
    shop_name,
    brand,
    product_variant,
    volume_ml,
    scrape_date,

    -- Pricing
    price_eur,
    price_per_100ml_eur,

    -- Market context
    min_price_eur,
    max_price_eur,
    avg_price_eur,
    median_price_eur,
    avg_price_per_100ml,
    price_spread_pct,
    shop_count,

    -- Relative positioning
    price_rank,
    premium_vs_cheapest_eur,
    pct_vs_avg,
    pct_vs_cheapest,

    -- Categorical label
    CASE
        WHEN price_rank = 1                      THEN 'Cheapest'
        WHEN pct_vs_avg BETWEEN -5.0 AND 5.0     THEN 'At Market'
        WHEN pct_vs_avg > 5.0                    THEN 'Above Market'
        ELSE                                          'Below Market'
    END                                                                     AS price_position,

    -- Reference for proposal
    suggested_price_eur,

    -- Traceability
    product_url,
    scraped_at

FROM joined
ORDER BY scrape_date DESC, price_rank ASC
