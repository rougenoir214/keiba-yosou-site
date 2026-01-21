# 競馬予想共有サイト 🏇

仲間内で競馬予想を競い合うWebアプリケーション

## 機能

- 👤 ユーザー登録・ログイン
- 🏇 レースデータの一括インポート（CSV）
- 🎯 予想（印）の入力
- 🎫 馬券の購入（複数種別、ボックス・フォーメーション対応）
- 🏁 レース結果の自動取得（スクレイピング）
- 💰 配当の自動計算
- 🏆 ユーザーランキング（シーズン別、収支/的中率/回収率で分割表示）
- 📊 収支・的中率の統計表示
- ⏰ 自動Keep-alive機能（Renderスリープ対策、24時間稼働）

## 技術スタック

- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Frontend**: EJS, Vanilla JavaScript
- **認証**: bcrypt, express-session
- **デプロイ**: Render.com

## ローカル開発環境のセットアップ

### 前提条件

- Node.js 18以上
- PostgreSQL 13以上

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/YOUR_USERNAME/keiba-yosou-site.git
cd keiba-yosou-site

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .envファイルを編集してデータベース接続情報を設定

### 環境変数の説明

- `PORT`: サーバーのポート番号（デフォルト: 3000）
- `NODE_ENV`: 環境（development / production）
- `DATABASE_URL`: PostgreSQL接続URL
- `SESSION_SECRET`: セッション暗号化キー
- `TEST_MODE`: テストモード（true / false）
  - `true`: 発走時刻を過ぎても予想印と馬券購入が可能（開発・テスト用）
  - `false`: 発走時刻以降は予想印と馬券購入が不可（本番環境用）

# データベースを初期化
psql -U postgres -d keiba_yosou -f db/schema.sql

# サーバーを起動
npm start
```

ブラウザで http://localhost:3000 にアクセス

## デプロイ

Render.comへのデプロイ手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照

## 使い方

### 1. ユーザー登録

- トップページから「新規登録」
- ユーザー名、表示名、パスワードを入力

### 2. レースデータのインポート

1. netkeiba.comから以下を実行：
```bash
cd C:\Users\rouge\OneDrive\keiba
venv\Scripts\activate.bat
python scrape_races.py
```

2. 生成されたCSVをアップロード：
   - http://localhost:3000/admin/import

### 3. 予想・馬券購入

- レース一覧から出馬表を表示
- 印を入力（◎○▲△☆）
- 馬券を購入（単勝、馬連、3連単など）

### 4. レース結果の登録

1. 結果をスクレイピング：
```bash
python scrape_results.py
```

2. CSVをインポート：
   - http://localhost:3000/admin/import-results

3. 配当を計算：
   - レース結果ページで「配当を計算する」ボタン

### 5. ランキング確認

- http://localhost:3000/ranking

## ディレクトリ構成

```
keiba-yosou-site/
├── db/
│   ├── connection.js    # データベース接続
│   └── schema.sql       # テーブル定義
├── routes/
│   ├── admin.js         # 管理機能
│   ├── auth.js          # 認証
│   ├── predictions.js   # 予想・馬券購入
│   ├── races.js         # レース表示
│   └── ranking.js       # ランキング
├── views/
│   ├── races/
│   ├── predictions/
│   └── ranking/
├── public/              # 静的ファイル
├── uploads/             # アップロードファイル（一時）
├── server.js            # エントリーポイント
├── package.json
├── .env.example         # 環境変数のサンプル
└── render.yaml          # Render.comデプロイ設定
```

## ライセンス

ISC

## 作者

競馬予想愛好会
