{{ config(materialized='table') }}

SELECT
    scrape_run_id,
    product_id,
    price_eur,
    DATE(scraped_at)    AS scrape_date

FROM {{ ref('staging_kikkoman_prices') }}
