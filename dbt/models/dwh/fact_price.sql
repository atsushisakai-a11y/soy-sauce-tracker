{{ config(materialized='table') }}

SELECT
    scrape_run_id,
    product_id,
    price_eur

FROM {{ ref('staging_kikkoman_prices') }}
