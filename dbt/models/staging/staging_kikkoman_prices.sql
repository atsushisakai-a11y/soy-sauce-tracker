{{ config(materialized='table') }}

/*
  Silver layer — cleaned and standardised prices.
  - Price parsed to FLOAT (EUR)
  - Price per 100ml computed
  - Rows with unparseable prices excluded
*/

WITH cleaned AS (

    SELECT
        scrape_run_id,
        shop_name,
        product_name,
        product_url,
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
        500                                     AS volume_ml

    FROM {{ ref('raw_kikkoman_prices') }}
    WHERE raw_price IS NOT NULL
      AND raw_price != ''

)

SELECT
    scrape_run_id,
    shop_name,
    'Kikkoman'                                  AS brand,
    'Koikuchi Shoyu'                            AS product_variant,
    volume_ml,
    price_eur,
    ROUND(price_eur / volume_ml * 100, 4)       AS price_per_100ml_eur,
    currency,
    product_url,
    scraped_at,
    _loaded_at

FROM cleaned
WHERE price_eur IS NOT NULL
  AND price_eur > 0
