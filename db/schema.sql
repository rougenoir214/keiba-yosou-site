-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 期間（シーズン）テーブル
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- レーステーブル
CREATE TABLE IF NOT EXISTS races (
    id SERIAL PRIMARY KEY,
    race_id VARCHAR(20) UNIQUE NOT NULL,
    race_name VARCHAR(100),
    race_date DATE NOT NULL,
    race_time TIME,
    venue VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 出走馬テーブル
CREATE TABLE IF NOT EXISTS horses (
    id SERIAL PRIMARY KEY,
    race_id VARCHAR(20) NOT NULL REFERENCES races(race_id),
    waku INTEGER,
    umaban INTEGER NOT NULL,
    horse_name VARCHAR(100) NOT NULL,
    age_sex VARCHAR(10),
    weight_load DECIMAL(4,1),
    jockey VARCHAR(50),
    stable VARCHAR(50),
    horse_weight VARCHAR(20)
);

-- レース結果テーブル
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    race_id VARCHAR(20) NOT NULL REFERENCES races(race_id),
    umaban INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    result_time VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(race_id, umaban)
);

-- 予想（印）テーブル
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    race_id VARCHAR(20) NOT NULL REFERENCES races(race_id),
    umaban INTEGER NOT NULL,
    mark VARCHAR(2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 馬券購入テーブル
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    race_id VARCHAR(20) NOT NULL REFERENCES races(race_id),
    bet_type VARCHAR(20) NOT NULL,
    horses TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (amount > 0 AND amount <= 10000)
);

-- 払戻結果テーブル
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    bet_id INTEGER NOT NULL REFERENCES bets(id),
    payout_amount INTEGER NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初期シーズンデータ
INSERT INTO seasons (name, start_date, end_date, is_active) VALUES
('2025年前期', '2025-01-01', '2025-06-30', true),
('2025年後期', '2025-07-01', '2025-12-31', false)
ON CONFLICT DO NOTHING;
