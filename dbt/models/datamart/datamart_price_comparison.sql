{{ config(materialized='view') }}

SELECT
    d.brand,
    d.product_name,
    DATE_TRUNC('month', f.scrape_date)    AS scrape_month,
    COUNT(DISTINCT d.shop_name)           AS shop_count,
    MIN(f.price_eur)                      AS min_price_eur,
    MAX(f.price_eur)                      AS max_price_eur,
    AVG(f.price_eur)                      AS avg_price_eur

FROM {{ ref('fact_price') }}  f
JOIN {{ ref('dim_price') }}   d  ON f.product_id = d.product_id

GROUP BY 1, 2, 3
