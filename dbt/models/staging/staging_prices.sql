{{ config(
    materialized='incremental',
    unique_key=['scrape_run_id', 'product_id']
) }}

/*
  Silver layer — cleaned and standardised prices.
  - Price parsed to FLOAT (EUR)
  - Price per 100ml computed
  - global_product_id joins matched products across shops via
    STAGING_PRODUCT_GROUPS (written by assign_product_ids.py)
  - Rows with unparseable prices excluded
*/

WITH cleaned AS (

    SELECT
        scrape_run_id,
        shop_name,
        product_name,
        SPLIT_PART(product_url, '?', 1)         AS product_url,
        image_url,
        scraped_at,
        _loaded_at,
        -- Strip €, EUR, whitespace; replace comma decimal separator with dot
        TRY_CAST(
            TRIM(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(raw_price, '€', ''),
                        'EUR', ''),
                    ' ', ''),
                ',', '.')
            ) AS FLOAT
        )                                       AS price_eur,
        'EUR'                                   AS currency,
        COALESCE(
            TRY_CAST(REGEXP_SUBSTR(product_name, '(\\d+)\\s*[Mm][Ll]', 1, 1, 'e', 1) AS INTEGER),
            500
        )                                       AS volume_ml

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
    -- Falls back to product_id for unmatched singletons (STAGING_PRODUCT_GROUPS
    -- covers all products, so COALESCE triggers only if the table is missing a row).
    COALESCE(
        pg.global_product_id,
        {{ dbt_utils.generate_surrogate_key(['c.product_name', 'c.shop_name', 'c.volume_ml']) }}
    )                                           AS global_product_id,
    c.shop_name,
    c.product_name,
    'Kikkoman'                                  AS brand,
    'Koikuchi Shoyu'                            AS product_variant,
    c.volume_ml,
    c.price_eur,
    ROUND(c.price_eur / c.volume_ml * 100, 4)  AS price_per_100ml_eur,
    c.currency,
    c.product_url,
    c.image_url,
    c.scraped_at,
    c._loaded_at

FROM cleaned c
LEFT JOIN {{ source('staging', 'STAGING_PRODUCT_GROUPS') }} pg
    ON  c.shop_name    = pg.shop_name
    AND c.product_name = pg.product_name

WHERE c.price_eur IS NOT NULL
  AND c.price_eur > 0
