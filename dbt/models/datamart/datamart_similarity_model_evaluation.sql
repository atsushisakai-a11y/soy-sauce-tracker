{{ config(materialized='view') }}

/*
  Datamart — datamart_similarity_model_evaluation
  Single-row data quality report for the IS_MATCH similarity pipeline.
  Precision / Recall / F1 / Accuracy are computed against the human-validated
  ground truth; pairs without a ground truth label are counted but excluded
  from metric computation.
*/

WITH counts AS (
    SELECT
        COUNT(*)                                                            AS total_pairs,
        COUNTIF(ground_truth_verdict IS NOT NULL)                           AS matched_with_gt,
        COUNTIF(ground_truth_verdict IS NULL)                               AS not_in_gt,
        COUNTIF(is_match     AND ground_truth_verdict = 'SAME')             AS true_positive,
        COUNTIF(is_match     AND ground_truth_verdict = 'DIFFERENT')        AS false_positive,
        COUNTIF(NOT is_match AND ground_truth_verdict = 'SAME')             AS false_negative,
        COUNTIF(NOT is_match AND ground_truth_verdict = 'DIFFERENT')        AS true_negative,
        MAX(computed_at)                                                     AS evaluated_at
    FROM {{ ref('fact_similarity_scores') }}
)

SELECT
    evaluated_at,
    total_pairs,
    matched_with_gt,
    not_in_gt,
    ROUND(matched_with_gt * 100.0 / NULLIF(total_pairs, 0), 1)              AS gt_coverage_pct,
    true_positive,
    false_positive,
    false_negative,
    true_negative,
    ROUND(
        true_positive / NULLIF(true_positive + false_positive, 0),
        3
    )                                                                         AS precision,
    ROUND(
        true_positive / NULLIF(true_positive + false_negative, 0),
        3
    )                                                                         AS recall,
    ROUND(
        2.0 * true_positive
            / NULLIF(2.0 * true_positive + false_positive + false_negative, 0),
        3
    )                                                                         AS f1,
    ROUND(
        (true_positive + true_negative) / NULLIF(matched_with_gt, 0),
        3
    )                                                                         AS accuracy

FROM counts
