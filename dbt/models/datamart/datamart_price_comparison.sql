{{ config(materialized='view') }}

WITH per_shop AS (

    SELECT
        d.global_product_id,
        d.shop_name,
        DATE_TRUNC(f.scrape_date, MONTH)    AS scrape_month,
        MAX(d.product_url)                  AS product_url,
        MAX(d.brand)                        AS brand,
        MAX(d.product_name)                 AS product_name,
        MAX(d.volume_ml)                    AS volume_ml,
        ROUND(MIN(f.price_eur), 2)          AS min_price_eur,
        ROUND(MAX(f.price_eur), 2)          AS max_price_eur,
        ROUND(AVG(f.price_eur), 2)          AS avg_price_eur

    FROM {{ ref('fact_price') }}  f
    JOIN {{ ref('dim_price') }}   d  ON f.product_id = d.product_id

    GROUP BY 1, 2, 3

)

SELECT
    p.global_product_id,
    p.shop_name,
    p.product_url,
    p.scrape_month,
    p.brand,
    p.product_name,
    p.volume_ml,
    COUNT(*) OVER (
        PARTITION BY p.global_product_id, p.scrape_month
    )                                       AS shop_count,
    p.min_price_eur,
    p.max_price_eur,
    p.avg_price_eur

FROM per_shop p
