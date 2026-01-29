-- 古いVAPIDキーで作成されたプッシュ通知購読を全削除
-- 新しいVAPIDキーで再購読が必要

-- 1. 通知履歴もクリア（オプション）
TRUNCATE TABLE race_notifications;

-- 2. プッシュ通知購読を全削除
TRUNCATE TABLE push_subscriptions;

-- 確認
SELECT COUNT(*) as remaining_subscriptions FROM push_subscriptions;
SELECT COUNT(*) as remaining_notifications FROM race_notifications;
