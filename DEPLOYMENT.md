# Render.comデプロイ手順

## 前提条件

- GitHubアカウント
- Render.comアカウント（無料プランでOK）
- このプロジェクトがGitHubリポジトリにプッシュされていること

## デプロイ手順

### 1. GitHubリポジトリの準備

#### プロジェクトをGitHubにプッシュ

```bash
cd C:\Users\rouge\OneDrive\keiba-yosou-site

# Gitリポジトリを初期化（まだの場合）
git init

# .gitignoreを作成
echo node_modules/ > .gitignore
echo .env >> .gitignore
echo uploads/ >> .gitignore

# ファイルをコミット
git add .
git commit -m "Initial commit"

# GitHubにプッシュ（リポジトリURLは自分のものに置き換え）
git remote add origin https://github.com/YOUR_USERNAME/keiba-yosou-site.git
git branch -M main
git push -u origin main
```

### 2. Render.comでのセットアップ

#### A. Render.comにログイン

1. https://render.com にアクセス
2. GitHubアカウントでログイン

#### B. New PostgreSQLデータベースを作成

1. Dashboardから「New +」→「PostgreSQL」
2. 設定：
   - **Name**: `keiba-yosou-db`
   - **Database**: `keiba_yosou`
   - **User**: `keiba_user`
   - **Region**: Singapore（日本に近い）
   - **Plan**: Free
3. 「Create Database」をクリック
4. データベースが作成されるまで数分待つ
5. **Internal Database URL**をコピーしておく

#### C. Webサービスを作成

1. Dashboardから「New +」→「Web Service」
2. GitHubリポジトリを選択
3. 設定：
   - **Name**: `keiba-yosou-site`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Root Directory**: 空欄（ルートディレクトリ）
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. 環境変数を設定（Environment Variables）：
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = （先ほどコピーしたInternal Database URL）
   - `SESSION_SECRET` = （ランダムな長い文字列、例: `your-very-long-random-secret-key-123456789`）
   - `PORT` = 削除（Renderが自動設定）

5. 「Create Web Service」をクリック

### 3. データベース初期化

デプロイが完了したら、データベースにテーブルを作成します。

#### A. Render.com Shellを使用

1. Webサービスのページで「Shell」タブをクリック
2. 以下のコマンドを実行：

```bash
# データベースに接続
psql $DATABASE_URL

# スキーマを実行（以下のSQLを1つずつ実行）
```

#### B. SQL実行内容

```sql
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
    horse_weight VARCHAR(20),
    CONSTRAINT horses_race_umaban_unique UNIQUE (race_id, umaban)
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
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payouts_bet_id_unique UNIQUE (bet_id)
);

-- レース払戻金テーブル
CREATE TABLE IF NOT EXISTS race_payouts (
    id SERIAL PRIMARY KEY,
    race_id VARCHAR(20) NOT NULL REFERENCES races(race_id),
    bet_type VARCHAR(20) NOT NULL,
    combination TEXT NOT NULL,
    payout INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(race_id, bet_type, combination)
);

-- 初期シーズンデータ
INSERT INTO seasons (name, start_date, end_date, is_active) VALUES
('2026年前期', '2026-01-01', '2026-06-30', true),
('2026年後期', '2026-07-01', '2026-12-31', false)
ON CONFLICT DO NOTHING;

-- 終了
\q
```

### 4. 動作確認

1. Render.comのダッシュボードでWebサービスのURLを確認
   - 例: `https://keiba-yosou-site.onrender.com`
2. ブラウザでアクセス
3. ユーザー登録・ログインをテスト
4. レースデータをインポート

## トラブルシューティング

### デプロイが失敗する場合

1. ログを確認：Render.comの「Logs」タブ
2. ビルドエラーの場合：
   - `package.json`の依存関係を確認
   - Node.jsバージョンを指定（`.node-version`ファイル作成）

### データベース接続エラー

1. 環境変数`DATABASE_URL`が正しく設定されているか確認
2. Internal Database URLを使用しているか確認（External URLは使わない）

### セッションエラー

1. `SESSION_SECRET`が設定されているか確認
2. 本番環境では長くランダムな文字列を使用

### アップロードが動作しない

Render.comの無料プランはエフェメラルファイルシステムなので、アップロードしたCSVは再デプロイ時に消えます。
- 本番環境では外部ストレージ（S3など）の使用を推奨
- または、CSVを直接データベースに保存する仕組みに変更

## 本番運用のヒント

1. **定期的なバックアップ**
   - Render.comのPostgreSQLは自動バックアップあり
   - 重要なデータは別途エクスポート推奨

2. **モニタリング**
   - Render.comのメトリクスで負荷を確認
   - ログを定期的にチェック

3. **セキュリティ**
   - SESSION_SECRETは強力なものを使用
   - 本番環境では必ずHTTPSを使用（Renderは自動）

4. **パフォーマンス**
   - 無料プランは15分アイドル後にスリープ
   - 有料プラン（月$7〜）でスリープなし

## 料金について

**無料プラン（Free）**
- Web Service: 750時間/月
- PostgreSQL: 90日間（その後削除される可能性）
- 15分間アクティビティなしでスリープ

**有料プラン（推奨）**
- Starter ($7/月): スリープなし、カスタムドメイン
- PostgreSQL ($7/月〜): 永続的、自動バックアップ

詳細: https://render.com/pricing
