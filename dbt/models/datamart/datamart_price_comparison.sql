{{ config(materialized='view') }}

SELECT
    brand,
    product_variant     AS product_name,
    shop_count,
    min_price_eur,
    max_price_eur,
    avg_price_eur

FROM {{ ref('fact_price') }}
