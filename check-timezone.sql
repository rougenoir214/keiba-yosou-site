-- タイムゾーン設定とデータ確認用SQL

-- 1. Supabaseのタイムゾーン設定を確認
SHOW timezone;

-- 2. 現在の時刻をいくつかの形式で表示
SELECT 
  CURRENT_DATE as current_date,
  CURRENT_TIME as current_time,
  CURRENT_TIMESTAMP as current_timestamp,
  NOW() as now,
  NOW() AT TIME ZONE 'UTC' as now_utc,
  NOW() AT TIME ZONE 'Asia/Tokyo' as now_jst;

-- 3. 今日のレースデータを確認
SELECT 
  race_id,
  race_name,
  race_date,
  race_time,
  pg_typeof(race_date) as date_type,
  pg_typeof(race_time) as time_type
FROM races
WHERE race_date = CURRENT_DATE
ORDER BY race_time
LIMIT 5;
