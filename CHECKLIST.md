# デプロイ前チェックリスト

デプロイする前に以下を確認してください。

## 必須項目

- [ ] GitHubアカウントを作成済み
- [ ] GitHubに新しいリポジトリを作成済み（public/private どちらでもOK）
- [ ] Render.comアカウントを作成済み（GitHubアカウントでログイン）
- [ ] ローカルで動作確認済み

## Gitリポジトリの準備

### 1. Gitの初期化と設定

```bash
cd C:\Users\rouge\OneDrive\keiba-yosou-site

# Git初期化（まだの場合）
git init

# ユーザー情報の設定（初回のみ）
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 2. ファイルの追加とコミット

```bash
# すべてのファイルをステージング
git add .

# コミット
git commit -m "Initial commit: 競馬予想共有サイト"
```

### 3. GitHubにプッシュ

```bash
# リモートリポジトリを追加（YOUR_USERNAMEとREPO_NAMEを置き換え）
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# ブランチ名をmainに変更
git branch -M main

# プッシュ
git push -u origin main
```

## Render.comでのセットアップ

### A. PostgreSQLデータベースを作成

1. Render.com Dashboardで「New +」→「PostgreSQL」
2. 設定：
   - Name: `keiba-yosou-db`
   - Database: `keiba_yosou`
   - User: `keiba_user`
   - Region: Singapore
   - Plan: Free
3. 作成後、**Internal Database URL**をコピー

### B. Webサービスを作成

1. 「New +」→「Web Service」
2. GitHubリポジトリを接続
3. 設定を入力
4. 環境変数を設定：
   ```
   NODE_ENV=production
   DATABASE_URL=[コピーしたInternal Database URL]
   SESSION_SECRET=[ランダムな長い文字列]
   ```
5. デプロイ開始

### C. データベース初期化

1. Webサービスページで「Shell」タブ
2. `psql $DATABASE_URL` を実行
3. DEPLOYMENT.mdのSQLを実行

## デプロイ後の確認

- [ ] サイトにアクセスできる
- [ ] ユーザー登録ができる
- [ ] ログインできる
- [ ] レース一覧が表示される
- [ ] データインポートができる

## トラブルシューティング

### ビルドエラー

- Logsタブでエラー内容を確認
- `package.json`の依存関係を確認
- Node.jsバージョンを確認（.node-versionファイル）

### データベース接続エラー

- DATABASE_URLが正しいか確認
- Internal URLを使用しているか確認（External URLは不可）

### 404エラー

- Build Commandが正しいか確認: `npm install`
- Start Commandが正しいか確認: `npm start`

## 次のステップ

デプロイが成功したら：

1. カスタムドメインの設定（有料プランで可能）
2. 定期的なバックアップ
3. モニタリングの設定
4. パフォーマンスの最適化

## 参考リンク

- Render.com Documentation: https://render.com/docs
- Node.js on Render: https://render.com/docs/deploy-node-express-app
- PostgreSQL on Render: https://render.com/docs/databases
