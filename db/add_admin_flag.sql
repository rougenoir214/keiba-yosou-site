-- ユーザーテーブルに管理者フラグを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 山本裕大を管理者として設定（display_nameで判定）
UPDATE users SET is_admin = true WHERE display_name = '山本裕大';

-- または、usernameで設定する場合（適切な方を選択）
-- UPDATE users SET is_admin = true WHERE username = 'あなたのusername';
