-- レース通知の送信履歴を記録するテーブル
CREATE TABLE IF NOT EXISTS race_notifications (
    id SERIAL PRIMARY KEY,
    race_id INTEGER REFERENCES races(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- '30min_before', '10min_before' など
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(race_id, user_id, notification_type)
);

-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_race_notifications_race_id ON race_notifications(race_id);
CREATE INDEX IF NOT EXISTS idx_race_notifications_sent_at ON race_notifications(sent_at);
