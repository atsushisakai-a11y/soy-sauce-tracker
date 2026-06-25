{{ config(materialized='table') }}

/*
  DWH — fact_similarity_scores
  One row per cross-shop product pair comparison.
  IS_MATCH is the DINOv2 pipeline verdict; ground_truth_verdict is the
  human-validated label (NULL when the pair is not in the ground truth set).

  product_id_1 / product_id_2 are resolved via dim_price so downstream
  datamart models can join to product attributes without carrying denormalised
  names through the fact table.  Both joins are LEFT so pairs for products not
  yet present in dim_price are retained rather than silently dropped.
*/

WITH scores AS (
    SELECT *
    FROM {{ source('staging', 'staging_similarity_scores_evaluated') }}
),

dim_p AS (
    SELECT product_id, shop_name, product_name
    FROM {{ ref('dim_price') }}
)

SELECT
    s.SIMILARITY_ID                                         AS similarity_id,
    s.SCRAPE_DATE                                           AS scrape_date,
    p1.product_id                                           AS product_id_1,
    p2.product_id                                           AS product_id_2,
    s.IMAGE_SIMILARITY                                      AS image_similarity,
    s.NAME_SIMILARITY                                       AS name_similarity,
    s.COMBINED_SCORE                                        AS combined_score,
    s.IS_MATCH                                              AS is_match,
    s.ground_truth_verdict,
    s.COMPUTED_AT                                           AS computed_at

FROM scores s
LEFT JOIN dim_p p1
    ON  LOWER(TRIM(s.SHOP_NAME_1))    = LOWER(TRIM(p1.shop_name))
    AND LOWER(TRIM(s.PRODUCT_NAME_1)) = LOWER(TRIM(p1.product_name))
LEFT JOIN dim_p p2
    ON  LOWER(TRIM(s.SHOP_NAME_2))    = LOWER(TRIM(p2.shop_name))
    AND LOWER(TRIM(s.PRODUCT_NAME_2)) = LOWER(TRIM(p2.product_name))
