{{ config(materialized='table') }}

SELECT
    NAME            AS shop_name,
    ADDRESS         AS address,
    WEBSITE         AS website,
    PHONE           AS phone,
    CUISINE         AS cuisine,
    SHOP_TYPE       AS shop_type,
    OSM_ID          AS osm_id,
    OSM_TYPE        AS osm_type,
    _LOADED_AT      AS _loaded_at

FROM {{ source('raw', 'RAW_SHOPS') }}
