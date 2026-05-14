{{ config(materialized='table') }}

SELECT
    shop_name,
    address,
    website,
    phone,
    cuisine,
    shop_type,
    osm_id,
    osm_type,
    _loaded_at

FROM {{ ref('raw_shops') }}

WHERE website IS NOT NULL
  AND website != ''
  AND (
       LOWER(cuisine) LIKE '%asian%'
    OR LOWER(cuisine) LIKE '%japanese%'
    OR LOWER(cuisine) LIKE '%chinese%'
    OR LOWER(cuisine) LIKE '%korean%'
    OR LOWER(cuisine) LIKE '%sushi%'
    OR LOWER(cuisine) LIKE '%thai%'
    OR LOWER(cuisine) LIKE '%vietnamese%'
  )
  AND LOWER(shop_type) IN ('convenience', 'supermarket', 'toko')
