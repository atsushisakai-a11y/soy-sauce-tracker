{{ config(materialized='table') }}

SELECT
    scrape_date,
    shop_name_1,
    shop_name_2,
    product_name_1,
    product_name_2,
    similarity_score,
    computed_at

FROM {{ source('raw', 'RAW_SIMILARITY_SCORES') }}
