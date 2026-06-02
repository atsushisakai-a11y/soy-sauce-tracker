{{ config(materialized='table') }}

/*
  DWH — dim_price_history  (SCD Type 2)
  One row per distinct version of a product's descriptive attributes.
  A new version is created whenever product_url or product_image_url changes.

  Columns:
    valid_from  — earliest scrape date this attribute combination was observed
    valid_to    — latest  scrape date this attribute combination was observed
    is_latest   — TRUE for the single most-recent version per product_id
*/

WITH versions AS (

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
        image_url                               AS product_image_url,
        MIN(DATE(scraped_at))                   AS valid_from,
        MAX(DATE(scraped_at))                   AS valid_to

    FROM {{ ref('staging_prices') }}
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10

),

ranked AS (

    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY product_id
            ORDER BY
                valid_to   DESC,
                valid_from DESC,
                -- Prefer clean image URL over JSON-LD object string over empty
                CASE
                    WHEN product_image_url IS NULL OR product_image_url = '' THEN 0
                    WHEN LEFT(product_image_url, 1) = '{'                    THEN 1
                    ELSE 2
                END DESC,
                -- Prefer non-null product URL
                CASE WHEN product_url IS NULL OR product_url = '' THEN 0 ELSE 1 END DESC
        ) AS rn
    FROM versions

)

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
    valid_to,
    (rn = 1)                                    AS is_latest

FROM ranked
