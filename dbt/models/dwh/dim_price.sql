{{ config(materialized='table') }}

/*
  DWH — dim_price
  Dimension table: one row per shop × product combination.
  global_product_id groups matched products across shops
  (e.g. Kikkoman Koikuchi 1L from Dun Yong and Shilla Market
   share the same global_product_id).
*/

SELECT DISTINCT
    product_id,
    global_product_id,
    shop_name,
    product_name,
    brand,
    product_variant,
    volume_ml,
    currency,
    product_url,
    image_url                               AS product_image_url

FROM {{ ref('staging_prices') }}
