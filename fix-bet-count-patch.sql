-- 既存馬券のbet_count（組み合わせ数）を正しく計算して更新するSQLパッチ
-- 実行日時: 2025-01-26

-- ========================================
-- 1. 単式（single）: 常に1点
-- ========================================
UPDATE bets 
SET bet_count = 1 
WHERE bet_format IS NULL OR bet_format = 'single';

-- ========================================
-- 2. BOX購入の組み合わせ数を計算
-- ========================================

-- 2-1. 馬連・ワイド（BOX）: nC2 = n*(n-1)/2
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(horses, ','), 1) * 
  (array_length(string_to_array(horses, ','), 1) - 1)
) / 2
WHERE bet_format = 'box' 
  AND bet_type IN ('umaren', 'wide');

-- 2-2. 馬単（BOX）: nP2 = n*(n-1)
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(horses, ','), 1) * 
  (array_length(string_to_array(horses, ','), 1) - 1)
)
WHERE bet_format = 'box' 
  AND bet_type = 'umatan';

-- 2-3. 3連複（BOX）: nC3 = n*(n-1)*(n-2)/6
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(horses, ','), 1) * 
  (array_length(string_to_array(horses, ','), 1) - 1) * 
  (array_length(string_to_array(horses, ','), 1) - 2)
) / 6
WHERE bet_format = 'box' 
  AND bet_type = 'sanrenpuku';

-- 2-4. 3連単（BOX）: nP3 = n*(n-1)*(n-2)
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(horses, ','), 1) * 
  (array_length(string_to_array(horses, ','), 1) - 1) * 
  (array_length(string_to_array(horses, ','), 1) - 2)
)
WHERE bet_format = 'box' 
  AND bet_type = 'sanrentan';

-- ========================================
-- 3. フォーメーション購入の組み合わせ数を計算
-- ========================================

-- 3-1. 馬連・ワイド（フォーメーション）: 軸×相手
-- 形式: "1,3-5,7" → 軸馬（1,3）× 相手馬（5,7）
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(split_part(horses, '-', 1), ','), 1) * 
  array_length(string_to_array(split_part(horses, '-', 2), ','), 1)
)
WHERE bet_format = 'formation' 
  AND bet_type IN ('umaren', 'wide')
  AND horses LIKE '%-%';

-- 3-2. 馬単（フォーメーション）: 1着候補×2着候補
-- 形式: "1,3-5,7" → 1着（1,3）× 2着（5,7）
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(split_part(horses, '-', 1), ','), 1) * 
  array_length(string_to_array(split_part(horses, '-', 2), ','), 1)
)
WHERE bet_format = 'formation' 
  AND bet_type = 'umatan'
  AND horses LIKE '%-%';

-- 3-3. 3連複（フォーメーション）: 1着候補×2着候補×3着候補
-- 形式: "1,3-5,7-9,11" → 1着（1,3）× 2着（5,7）× 3着（9,11）
-- 注: 重複を除くため、実際の点数は計算値より少ない可能性があります
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(split_part(horses, '-', 1), ','), 1) * 
  array_length(string_to_array(split_part(horses, '-', 2), ','), 1) * 
  array_length(string_to_array(split_part(horses, '-', 3), ','), 1)
)
WHERE bet_format = 'formation' 
  AND bet_type = 'sanrenpuku'
  AND horses LIKE '%-%-%';

-- 3-4. 3連単（フォーメーション）: 1着候補×2着候補×3着候補
-- 形式: "1,3-5,7-9,11" → 1着（1,3）× 2着（5,7）× 3着（9,11）
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(split_part(horses, '-', 1), ','), 1) * 
  array_length(string_to_array(split_part(horses, '-', 2), ','), 1) * 
  array_length(string_to_array(split_part(horses, '-', 3), ','), 1)
)
WHERE bet_format = 'formation' 
  AND bet_type = 'sanrentan'
  AND horses LIKE '%-%-%';

-- ========================================
-- 4. 流し（nagashi）の組み合わせ数を計算
-- ========================================

-- 4-1. 馬連・ワイド（流し）: 軸>相手
-- 形式: "1>5,7,9" → 軸（1）× 相手（5,7,9）= 3点
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(split_part(horses, '>', 2), ','), 1)
)
WHERE bet_format = 'nagashi' 
  AND bet_type IN ('umaren', 'wide')
  AND horses LIKE '%>%';

-- 4-2. 馬単（流し）: 1着>2着
-- 形式: "1>5,7,9" → 1着（1）× 2着（5,7,9）= 3点
UPDATE bets 
SET bet_count = (
  array_length(string_to_array(split_part(horses, '>', 2), ','), 1)
)
WHERE bet_format = 'nagashi' 
  AND bet_type = 'umatan'
  AND horses LIKE '%>%';

-- ========================================
-- 5. 確認用クエリ
-- ========================================

-- 各馬券種別ごとの組み合わせ数を確認
SELECT 
  bet_type,
  bet_format,
  horses,
  amount,
  bet_count,
  amount / NULLIF(bet_count, 0) as amount_per_bet
FROM bets
WHERE bet_count IS NOT NULL
ORDER BY bet_type, bet_format, bet_count DESC
LIMIT 50;
