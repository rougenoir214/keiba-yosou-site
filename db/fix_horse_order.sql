-- 既存の単式馬券で馬番が正しくソートされていないデータを修正
-- 馬連・ワイド・3連複など順不同の馬券種別が対象

-- まず確認（実行前に確認用）
-- SELECT id, bet_type, horses, bet_format
-- FROM bets
-- WHERE bet_format = 'single'
-- AND bet_type IN ('umaren', 'wide', 'sanrenpuku')
-- ORDER BY id;

-- 修正用の一時関数を作成
CREATE OR REPLACE FUNCTION sort_horses(horses_str TEXT) RETURNS TEXT AS $$
DECLARE
    horses_array TEXT[];
    sorted_array INT[];
BEGIN
    -- カンマで分割
    horses_array := string_to_array(horses_str, ',');
    
    -- 数値に変換してソート
    sorted_array := ARRAY(
        SELECT unnest(horses_array)::INT
        ORDER BY unnest(horses_array)::INT
    );
    
    -- カンマ区切りの文字列に戻す
    RETURN array_to_string(sorted_array, ',');
END;
$$ LANGUAGE plpgsql;

-- 馬連の単式馬券を修正
UPDATE bets
SET horses = sort_horses(horses)
WHERE bet_format = 'single'
AND bet_type = 'umaren'
AND horses != sort_horses(horses);

-- ワイドの単式馬券を修正
UPDATE bets
SET horses = sort_horses(horses)
WHERE bet_format = 'single'
AND bet_type = 'wide'
AND horses != sort_horses(horses);

-- 3連複の単式馬券を修正
UPDATE bets
SET horses = sort_horses(horses)
WHERE bet_format = 'single'
AND bet_type = 'sanrenpuku'
AND horses != sort_horses(horses);

-- 関数を削除
DROP FUNCTION IF EXISTS sort_horses(TEXT);

-- 修正結果を確認
SELECT 
    bet_type,
    COUNT(*) as count,
    string_agg(DISTINCT horses, ', ' ORDER BY horses) as sample_horses
FROM bets
WHERE bet_format = 'single'
AND bet_type IN ('umaren', 'wide', 'sanrenpuku')
GROUP BY bet_type
ORDER BY bet_type;
