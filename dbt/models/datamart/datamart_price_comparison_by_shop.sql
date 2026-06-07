{{ config(materialized='view') }}

/*
  Datamart — price comparison aggregated by shop and month.
  One row per shop per scrape_month.
  Used for the "Best Value by Shop" chart on the dashboard.
*/

SELECT
    shop_name,
    scrape_month,
    COUNT(DISTINCT global_product_id)           AS product_count,
    COUNT(DISTINCT brand)                       AS brand_count,
    ROUND(AVG(avg_price_per_100ml), 2)          AS avg_price_per_100ml,
    ROUND(MIN(avg_price_per_100ml), 2)          AS min_price_per_100ml,
    ROUND(MAX(avg_price_per_100ml), 2)          AS max_price_per_100ml,
    ROUND(AVG(avg_price_eur), 2)                AS avg_price_eur,
    ROUND(MIN(min_price_eur), 2)                AS min_price_eur,
    ROUND(MAX(max_price_eur), 2)                AS max_price_eur

FROM {{ ref('datamart_price_comparison') }}

WHERE scrape_month = (SELECT MAX(scrape_month) FROM {{ ref('datamart_price_comparison') }})

GROUP BY 1, 2
