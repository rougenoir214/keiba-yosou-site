-- 馬券購入形式カラムを追加
ALTER TABLE bets ADD COLUMN bet_format VARCHAR(20) DEFAULT 'single';

-- 既存データはすべて単式として設定（既にDEFAULT値があるので不要だが念のため）
UPDATE bets SET bet_format = 'single' WHERE bet_format IS NULL;

-- bet_formatの値は以下のいずれか:
-- 'single' : 単式
-- 'box' : ボックス
-- 'formation' : フォーメーション  
-- 'nagashi' : 流し
