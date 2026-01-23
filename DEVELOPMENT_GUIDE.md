# 🛠️ keiba-yosou-site 開発ガイドライン

このドキュメントは、プロジェクトの開発フローとベストプラクティスをまとめたものです。

## 📋 目次

1. [開発環境](#開発環境)
2. [基本的な開発フロー](#基本的な開発フロー)
3. [ブランチ管理](#ブランチ管理)
4. [コーディング規約](#コーディング規約)
5. [トラブルシューティング](#トラブルシューティング)

---

## 🖥️ 開発環境

### プロジェクト構成

```
C:\Users\rouge\OneDrive\keiba-yosou-site\
├── db\              # データベース関連
├── routes\          # Expressルート
├── views\           # EJSビュー
├── public\          # 静的ファイル
├── server.js        # サーバーエントリポイント
├── package.json
└── .env            # 環境変数（Git管理外）
```

### 技術スタック

- **バックエンド**: Node.js + Express
- **データベース**: PostgreSQL (Supabase)
- **テンプレート**: EJS
- **ホスティング**: Render.com
- **スクレイピング**: axios + cheerio

### 環境変数

`.env` ファイルに以下を設定：

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
NODE_ENV=development  # ローカルは development
RENDER_URL=https://...  # 本番環境のみ
```

---

## 🔄 基本的な開発フロー

### ⚠️ 重要な原則

**必ずローカル環境で動作確認してからGit同期する**

### 開発手順（必須）

#### 1. ブランチ作成

```cmd
cd C:\Users\rouge\OneDrive\keiba-yosou-site
git checkout -b feature/機能名
```

**ブランチ命名規則**:
- `feature/` - 新機能追加
- `fix/` - バグ修正
- `refactor/` - リファクタリング
- `docs/` - ドキュメント更新

例:
- `feature/user-settings`
- `fix/ranking-display`
- `refactor/bet-logic`

#### 2. コード編集

**Desktop Commanderを使用して編集**:

```
# ファイル読み込み
Desktop Commander:read_file

# ファイル編集
Desktop Commander:edit_block

# 新規ファイル作成
Desktop Commander:write_file (mode=rewrite)
```

#### 3. ローカルでテスト（最重要）

```cmd
cd C:\Users\rouge\OneDrive\keiba-yosou-site
npm start
```

ブラウザで `http://localhost:3000` を開いて動作確認：

**チェックリスト**:
- [ ] ページが正しく表示される
- [ ] エラーが出ない（コンソールも確認）
- [ ] 新機能が意図通り動作する
- [ ] 既存機能が壊れていない

#### 4. Git コミット

```cmd
git add .
git commit -m "feat: 機能の説明"
```

**コミットメッセージ規則**:
- `feat:` - 新機能
- `fix:` - バグ修正
- `refactor:` - リファクタリング
- `docs:` - ドキュメント
- `style:` - コードスタイル修正
- `test:` - テスト追加

#### 5. GitHubにプッシュ

```cmd
git push -u origin feature/機能名
```

#### 6. ローカルで最終確認

プッシュ後、もう一度ローカルで動作確認：

```cmd
npm start
```

#### 7. mainブランチにマージ

```cmd
git checkout main
git merge feature/機能名
git push origin main
```

#### 8. Renderで自動デプロイ確認

- Render.comのダッシュボードで自動デプロイを確認
- 本番環境でも動作確認

---

## 🌿 ブランチ管理

### ブランチ戦略

```
main (本番環境と同期)
  ├── feature/user-settings (作業ブランチ)
  ├── feature/split-ranking (作業ブランチ)
  └── fix/encoding-issue (作業ブランチ)
```

### ロールバック方法

問題が発生した場合、GitHubのWeb UIで簡単に元に戻せます：

1. GitHub リポジトリページを開く
2. 「Branches」タブをクリック
3. 問題のブランチを削除
4. ローカルで `git checkout main` して元に戻す

### ブランチのクリーンアップ

マージ後、不要なブランチは削除：

```cmd
git branch -d feature/機能名  # ローカル削除
git push origin --delete feature/機能名  # リモート削除
```

---

## 📝 コーディング規約

### ファイル構成規則

#### ルートファイル（routes/）

- 1ファイル = 1機能領域
- 例: `auth.js`, `races.js`, `predictions.js`

#### ビューファイル（views/）

- ディレクトリで機能ごとに整理
- 例: `views/auth/login.ejs`, `views/races/detail.ejs`

### データベースアクセス

**必ずプールを使用**:

```javascript
const pool = require('../db/connection');

// ✅ Good
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ Bad - SQLインジェクションの危険
const result = await pool.query(`SELECT * FROM users WHERE id = ${userId}`);
```

### エラーハンドリング

```javascript
try {
  // 処理
} catch (error) {
  console.error('エラー詳細:', error);
  res.render('page', { 
    error: 'ユーザーに表示するエラーメッセージ' 
  });
}
```

### セッション管理

```javascript
// セッションチェック
if (!req.session.user) {
  return res.redirect('/auth/login');
}

// セッション情報の利用
const userId = req.session.user.id;
```

---

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 問題1: ローカルサーバーが起動しない

**症状**: `npm start` でエラーが出る

**解決方法**:
```cmd
# node_modulesを削除して再インストール
rd /s /q node_modules
del package-lock.json
npm install
npm start
```

#### 問題2: データベース接続エラー

**症状**: `connection to server failed`

**解決方法**:
1. `.env` ファイルの `DATABASE_URL` を確認
2. Supabaseダッシュボードで接続情報を再確認
3. ネットワーク接続を確認

#### 問題3: ポート3000が使用中

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**解決方法**:
```cmd
# 使用中のプロセスを終了
netstat -ano | findstr :3000
taskkill /PID <PID番号> /F

# または別のポートを使用
set PORT=3001
npm start
```

#### 問題4: Gitで日本語が文字化け

**症状**: コミットメッセージが文字化け

**解決方法**:
```cmd
# PowerShellを使用
cd C:\Users\rouge\OneDrive\keiba-yosou-site
git commit -m "feat: Add user settings"
```

#### 問題5: スクレイピングが失敗する

**症状**: レース情報が取得できない

**解決方法**:
1. netkeibaのHTML構造が変わっていないか確認
2. セレクタを更新
3. タイムアウト時間を増やす

---

## 📚 参考資料

### プロジェクト内ドキュメント

- `CHECKLIST.md` - 機能実装チェックリスト
- `DEPLOYMENT.md` - デプロイ手順
- `GIT_WORKFLOW.md` - Git操作ガイド
- `db/schema.sql` - データベーススキーマ

### 外部リソース

- [Express.js ドキュメント](https://expressjs.com/)
- [EJS ドキュメント](https://ejs.co/)
- [Supabase ドキュメント](https://supabase.com/docs)
- [Render.com ドキュメント](https://render.com/docs)

---

## ✅ 開発前チェックリスト

新しい機能を実装する前に確認：

- [ ] ブランチを作成した
- [ ] `.env` ファイルが正しく設定されている
- [ ] ローカルサーバーが起動する
- [ ] データベース接続が確認できる

## ✅ 実装後チェックリスト

コードをプッシュする前に確認：

- [ ] ローカルで動作確認済み
- [ ] エラーが出ていない
- [ ] コンソールにエラーがない
- [ ] 既存機能が壊れていない
- [ ] コードにコメントを追加した
- [ ] わかりやすいコミットメッセージを書いた

---

**最終更新: 2026-01-23**
**作成者: Claude (AI Assistant)**
