{{ config(materialized='table') }}

/*
  Gold layer — one aggregated row per product × scrape date.
  Provides market-level statistics used by the datamart.
*/

SELECT
    brand,
    product_variant,
    volume_ml,
    DATE(scraped_at)                            AS scrape_date,

    COUNT(DISTINCT shop_name)                   AS shop_count,

    -- Price range
    MIN(price_eur)                              AS min_price_eur,
    MAX(price_eur)                              AS max_price_eur,
    ROUND(AVG(price_eur), 4)                    AS avg_price_eur,
    ROUND(MEDIAN(price_eur), 4)                 AS median_price_eur,
    ROUND(STDDEV(price_eur), 4)                 AS stddev_price_eur,

    -- Price per 100ml range
    MIN(price_per_100ml_eur)                    AS min_price_per_100ml,
    MAX(price_per_100ml_eur)                    AS max_price_per_100ml,
    ROUND(AVG(price_per_100ml_eur), 4)          AS avg_price_per_100ml,

    -- Range spread (useful signal for Kikkoman: how wide is the market pricing?)
    ROUND(MAX(price_eur) - MIN(price_eur), 2)   AS price_range_eur,
    ROUND(
        (MAX(price_eur) - MIN(price_eur)) / MIN(price_eur) * 100,
        2
    )                                           AS price_spread_pct

FROM {{ ref('staging_kikkoman_prices') }}
GROUP BY 1, 2, 3, 4
