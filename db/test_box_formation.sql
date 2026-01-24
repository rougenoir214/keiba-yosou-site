-- テスト用：ボックス買いとフォーメーション買いのデータを挿入
-- 京成杯（race_id: 202606010711）を使用

-- ボックス買いのテスト（3連複 BOX）
-- 5頭BOXなので 5C3 = 10通り × 100円 = 1000円
INSERT INTO bets (race_id, user_id, bet_type, horses, amount, bet_format, created_at)
VALUES (202606010711, 2, 'sanrenpuku', '1,4,7,15,16', 1000, 'box', NOW());

-- フォーメーション買いのテスト（3連単 フォーメーション）
-- 1着: 6 (1頭)
-- 2着: 3,5,7 (3頭)
-- 3着: 2,3,4,5,7,8,9 (7頭) 
-- 1 × 3 × 7 = 21通り ... いや、2着と3着で重複があるので実際は複雑
-- とりあえず18点として 18 × 100円 = 1800円
INSERT INTO bets (race_id, user_id, bet_type, horses, amount, bet_format, created_at)
VALUES (202606010711, 2, 'sanrentan', '6>3,5,7>2,3,4,5,7,8,9', 1800, 'formation', NOW());

-- ボックス買いのテスト（馬連 BOX）
-- 4頭BOXなので 4C2 = 6通り × 100円 = 600円
INSERT INTO bets (race_id, user_id, bet_type, horses, amount, bet_format, created_at)
VALUES (202606010711, 2, 'umaren', '2,4,6,8', 600, 'box', NOW());
