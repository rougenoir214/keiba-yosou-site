-- 管理者ユーザーを直接作成（パスワードは bcrypt でハッシュ化が必要）
-- このスクリプトは参考用です。実際は Web から登録して、後で is_admin を true にする方が簡単です。

-- 既存のユーザーを管理者にする場合（推奨）
UPDATE users SET is_admin = true WHERE username = 'あなたのusername';

-- または display_name で指定
UPDATE users SET is_admin = true WHERE display_name = '山本裕大';

-- 確認
SELECT id, username, display_name, is_admin FROM users WHERE is_admin = true;
