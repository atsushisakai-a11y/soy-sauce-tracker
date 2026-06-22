{{ config(
    materialized='incremental',
    unique_key=['scrape_run_id', 'product_id']
) }}

/*
  Silver layer — cleaned and standardised prices.
  - Price parsed to FLOAT64 (EUR)
  - Price per 100ml computed
  - global_product_id joins matched products across shops via
    staging_product_groups (written by assign_product_ids.py)
  - Rows with unparseable prices excluded
*/

WITH cleaned AS (

    SELECT
        scrape_run_id,
        shop_name,
        product_name,
        CASE
            WHEN STRPOS(product_url, '?') > 0
            THEN SUBSTR(product_url, 1, STRPOS(product_url, '?') - 1)
            ELSE product_url
        END                                         AS product_url,
        image_url,
        scraped_at,
        _loaded_at,
        -- Strip €, EUR, whitespace; replace comma decimal separator with dot
        SAFE_CAST(
            TRIM(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(raw_price, '€', ''),
                        'EUR', ''),
                    ' ', ''),
                ',', '.')
            ) AS FLOAT64
        )                                           AS price_eur,
        'EUR'                                       AS currency,
        -- Parse size: ml takes priority (e.g. "500ml"), then L (e.g. "1L", "1.5L"), else 500 default
        -- ml is checked first so the bare [Ll] branch never fires on "500ml" products
        CASE
            WHEN REGEXP_CONTAINS(product_name, r'\d+\s*[Mm][Ll]')
                THEN SAFE_CAST(REGEXP_EXTRACT(product_name, r'(\d+)\s*[Mm][Ll]') AS INT64)
            WHEN REGEXP_CONTAINS(product_name, r'\d+(?:\.\d+)?\s*[Ll]')
                THEN CAST(
                    CAST(REGEXP_EXTRACT(product_name, r'(\d+(?:\.\d+)?)\s*[Ll]') AS FLOAT64)
                    * 1000 AS INT64
                )
            ELSE 500
        END                                         AS volume_ml,
        -- Brand detection: only the top 5 brands by product count are tracked.
        -- Products from other brands are excluded at this layer (brand = 'Other').
        CASE
            WHEN LOWER(product_name) LIKE '%kikkoman%'           THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%pearl river bridge%' THEN 'Pearl River Bridge'
            WHEN LOWER(product_name) LIKE '%lee kum kee%'        THEN 'Lee Kum Kee'
            WHEN LOWER(product_name) LIKE '%yamasa%'             THEN 'Yamasa'
            WHEN LOWER(product_name) LIKE '%abc%'                THEN 'ABC'
            -- Kikkoman product lines that omit the brand name
            WHEN LOWER(product_name) LIKE '%tokusen%'            THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%gen_en%'             THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%kishibori%'          THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%koikuchi shoyu%'     THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%nama soy%'           THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%teriyaki bbq%'       THEN 'Kikkoman'
            WHEN LOWER(product_name) LIKE '%gluten free tamari%' THEN 'Kikkoman'
            ELSE 'Other'
        END                                         AS brand

    FROM {{ ref('raw_kikkoman_prices') }}
    WHERE raw_price IS NOT NULL
      AND raw_price != ''

    {% if is_incremental() %}
      AND scraped_at > (SELECT MAX(scraped_at) FROM {{ this }})
    {% endif %}

)

SELECT
    c.scrape_run_id,
    {{ dbt_utils.generate_surrogate_key(['c.product_name', 'c.shop_name', 'c.volume_ml']) }}
                                                    AS product_id,
    -- global_product_id: shared UUID for products matched across shops.
    -- Falls back to product_id for unmatched singletons (staging_product_groups
    -- covers all products, so COALESCE triggers only if the table is missing a row).
    COALESCE(
        pg.global_product_id,
        {{ dbt_utils.generate_surrogate_key(['c.product_name', 'c.shop_name', 'c.volume_ml']) }}
    )                                               AS global_product_id,
    c.shop_name,
    c.product_name,
    c.brand,
    CASE
        WHEN LOWER(c.product_name) LIKE '%less salt%'
          OR LOWER(c.product_name) LIKE '%gen_en%'
          OR LOWER(c.product_name) LIKE '%reduced salt%'      THEN 'Reduced Salt'
        WHEN LOWER(c.product_name) LIKE '%tamari%'            THEN 'Tamari'
        WHEN LOWER(c.product_name) LIKE '%ponzu%'             THEN 'Ponzu'
        WHEN LOWER(c.product_name) LIKE '%teriyaki%'          THEN 'Teriyaki'
        WHEN LOWER(c.product_name) LIKE '%usukuchi%'
          OR LOWER(c.product_name) LIKE '%light soy%'         THEN 'Light Soy Sauce'
        WHEN LOWER(c.product_name) LIKE '%dark soy%'          THEN 'Dark Soy Sauce'
        WHEN LOWER(c.product_name) LIKE '%sweet%'
          OR LOWER(c.product_name) LIKE '%kecap manis%'       THEN 'Sweet Soy Sauce'
        ELSE 'Koikuchi Shoyu'
    END                                             AS product_variant,
    c.volume_ml,
    c.price_eur,
    ROUND(c.price_eur / c.volume_ml * 100, 4)      AS price_per_100ml_eur,
    c.currency,
    c.product_url,
    c.image_url,
    c.scraped_at,
    c._loaded_at

FROM cleaned c
LEFT JOIN {{ source('staging', 'staging_product_groups') }} pg
    ON  c.shop_name    = pg.SHOP_NAME
    AND c.product_name = pg.PRODUCT_NAME

WHERE c.price_eur IS NOT NULL
  AND c.price_eur > 0
  AND c.brand != 'Other'
