{{ config(materialized='view') }}

/*
  Bronze layer — raw source cast to explicit types, no business logic.
  One row = one scraped price observation.
*/

SELECT
    scrape_run_id::VARCHAR(36)    AS scrape_run_id,
    shop_name::VARCHAR(255)       AS shop_name,
    product_name::VARCHAR(500)    AS product_name,
    raw_price::VARCHAR(100)       AS raw_price,
    currency::VARCHAR(10)         AS currency,
    product_url::VARCHAR(2000)    AS product_url,
    scraped_at::TIMESTAMP_NTZ     AS scraped_at,
    _loaded_at::TIMESTAMP_NTZ     AS _loaded_at

FROM {{ source('raw', 'raw_kikkoman_prices') }}
