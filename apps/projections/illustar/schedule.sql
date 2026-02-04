-- Illustar schedule projection
-- Source: data/illustar/schedule.jsonl
-- Output: apps/projections/out/illustar/schedule.parquet

COPY (
  SELECT
    id,
    event_name,
    TRY_CAST(event_date AS DATE) AS event_date,
    event_location,
    event_desc,
    image,
    image_info.id AS image_info_id,
    image_info.original_name AS image_info_original_name,
    image_info.url AS image_info_url
  FROM read_json_auto('data/illustar/schedule.jsonl')
  ORDER BY id
) TO 'apps/projections/out/illustar/schedule.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
