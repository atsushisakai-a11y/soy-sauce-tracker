{{ config(materialized='table') }}

/*
  DWH — dim_price
  Dimension table: one row per shop × product combination.
  Captures descriptive attributes that don't change per scrape run.
*/

SELECT DISTINCT
    product_id,
    shop_name,
    brand,
    product_variant,
    volume_ml,
    currency,
    product_url

FROM {{ ref('staging_kikkoman_prices') }}
