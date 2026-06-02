{{ config(materialized='table') }}

/*
  DWH — dim_price
  One row per product — the latest version from dim_price_history.
  For full attribute history see dim_price_history.
*/

SELECT
    product_id,
    global_product_id,
    shop_name,
    product_name,
    brand,
    product_variant,
    volume_ml,
    currency,
    product_url,
    product_image_url,
    valid_from,
    valid_to

FROM {{ ref('dim_price_history') }}
WHERE is_latest = TRUE
