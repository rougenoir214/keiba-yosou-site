-- レース払戻金テーブル（オッズ情報）
CREATE TABLE IF NOT EXISTS race_payouts (
    id SERIAL PRIMARY KEY,
    race_id VARCHAR(20) NOT NULL REFERENCES races(race_id),
    bet_type VARCHAR(20) NOT NULL,
    combination TEXT NOT NULL,
    payout INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(race_id, bet_type, combination)
);
