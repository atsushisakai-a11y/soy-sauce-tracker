{{ config(materialized='table') }}

SELECT
    {{ dbt_utils.generate_surrogate_key(['shop_name', 'address', 'osm_id']) }} AS shop_id,
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
  AND LOWER(shop_type) IN ('convenience', 'supermarket', 'toko')
