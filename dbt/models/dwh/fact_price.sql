{{ config(materialized='table') }}

/*
  DWH — fact_price
  Fact table: one row per shop per scrape run.
  Contains price measurements and pre-computed market benchmarks.
*/

WITH staging AS (
    SELECT * FROM {{ ref('staging_kikkoman_prices') }}
),

market AS (
    SELECT
        brand,
        product_variant,
        volume_ml,
        DATE(scraped_at)                            AS scrape_date,
        COUNT(DISTINCT shop_name)                   AS shop_count,
        MIN(price_eur)                              AS min_price_eur,
        MAX(price_eur)                              AS max_price_eur,
        ROUND(AVG(price_eur), 4)                    AS avg_price_eur,
        ROUND(MEDIAN(price_eur), 4)                 AS median_price_eur,
        ROUND(STDDEV(price_eur), 4)                 AS stddev_price_eur
    FROM staging
    GROUP BY 1, 2, 3, 4
)

SELECT
    -- Keys
    s.scrape_run_id,
    s.product_id,
    {{ dbt_utils.generate_surrogate_key(['s.shop_name', 's.brand', 's.product_variant', 's.volume_ml']) }}
                                                    AS price_dim_key,

    -- Dimensions
    s.shop_name,
    s.brand,
    s.product_variant,
    s.volume_ml,

    -- Price facts
    s.price_eur,
    s.price_per_100ml_eur,

    -- Market benchmarks (per scrape date)
    m.shop_count,
    m.min_price_eur,
    m.max_price_eur,
    m.avg_price_eur,
    m.median_price_eur,
    m.stddev_price_eur,

    -- Derived metrics
    ROUND(s.price_eur - m.min_price_eur, 2)         AS premium_vs_cheapest_eur,
    ROUND(
        (s.price_eur - m.avg_price_eur) / m.avg_price_eur * 100,
        2
    )                                               AS pct_vs_avg,
    RANK() OVER (
        PARTITION BY s.brand, s.product_variant, s.volume_ml, DATE(s.scraped_at)
        ORDER BY s.price_eur ASC
    )                                               AS price_rank,

    -- Timestamps
    DATE(s.scraped_at)                              AS scrape_date,
    s.scraped_at,
    s._loaded_at

FROM staging s
LEFT JOIN market m
    ON  s.brand            = m.brand
    AND s.product_variant  = m.product_variant
    AND s.volume_ml        = m.volume_ml
    AND DATE(s.scraped_at) = m.scrape_date
