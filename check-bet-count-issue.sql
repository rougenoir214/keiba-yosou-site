-- bet_countが0になってしまったデータを調査するSQL

-- 1. 0点になってしまったデータを確認
SELECT 
  id,
  bet_type,
  bet_format,
  horses,
  amount,
  bet_count
FROM bets
WHERE bet_count = 0
LIMIT 20;

-- 2. bet_formatの分布を確認
SELECT 
  bet_format,
  COUNT(*) as count
FROM bets
GROUP BY bet_format
ORDER BY count DESC;

-- 3. 各bet_typeとbet_formatの組み合わせを確認
SELECT 
  bet_type,
  bet_format,
  COUNT(*) as count,
  MIN(horses) as sample_horses
FROM bets
GROUP BY bet_type, bet_format
ORDER BY bet_type, bet_format;
