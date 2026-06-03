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
        COALESCE(
            SAFE_CAST(REGEXP_EXTRACT(product_name, r'(\d+)\s*[Mm][Ll]') AS INT64),
            500
        )                                           AS volume_ml

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
    'Kikkoman'                                      AS brand,
    'Koikuchi Shoyu'                                AS product_variant,
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
