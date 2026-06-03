{{ config(
    materialized='incremental',
    unique_key=['scrape_run_id', 'product_id']
) }}

SELECT
    scrape_run_id,
    product_id,
    price_eur,
    DATE(scraped_at)    AS scrape_date

FROM {{ ref('staging_prices') }}

{% if is_incremental() %}
WHERE DATE(scraped_at) > (SELECT MAX(scrape_date) FROM {{ this }})
{% endif %}
