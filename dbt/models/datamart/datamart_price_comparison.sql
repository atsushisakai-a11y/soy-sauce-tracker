{{ config(materialized='view') }}

SELECT
    brand,
    product_variant         AS product_name,
    shop_count,
    MIN(price_eur)          AS min_price_eur,
    MAX(price_eur)          AS max_price_eur,
    AVG(price_eur)          AS avg_price_eur

FROM {{ ref('fact_price') }}
GROUP BY 1, 2, 3
