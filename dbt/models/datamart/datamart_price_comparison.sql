{{ config(materialized='view') }}

SELECT
    d.brand,
    d.global_product_id,
    DATE_TRUNC(f.scrape_date, MONTH)        AS scrape_month,
    MAX(d.product_name)                     AS product_name,
    MAX(d.volume_ml)                        AS volume_ml,
    COUNT(DISTINCT d.shop_name)             AS shop_count,
    MIN(f.price_eur)                        AS min_price_eur,
    MAX(f.price_eur)                        AS max_price_eur,
    AVG(f.price_eur)                        AS avg_price_eur

FROM {{ ref('fact_price') }}  f
JOIN {{ ref('dim_price') }}   d  ON f.product_id = d.product_id

GROUP BY 1, 2, 3
