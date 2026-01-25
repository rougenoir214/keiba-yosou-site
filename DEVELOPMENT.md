# 開発ガイドライン

## 基本的な開発フロー

### 1. ブランチ運用

新しい機能や修正を行う際は、必ず **feature ブランチ**を作成してください。

```bash
# 例：ヘルプページの追加
git checkout -b feature/add-help-page

# 例：馬単フォーメーションのバグ修正
git checkout -b fix/umatan-formation-delimiter

# 例：UI改善
git checkout -b improve/betting-ticket-display
```

**ブランチ命名規則：**
- `feature/` - 新機能追加
- `fix/` - バグ修正
- `improve/` - 既存機能の改善
- `refactor/` - リファクタリング

### 2. ローカル環境でのテスト

**必ず本番デプロイ前にローカルでテストしてください。**

```bash
# ローカルサーバーを起動
cd C:\Users\rouge\OneDrive\keiba-yosou-site
set NODE_ENV=development
node server.js
```

**テスト確認項目：**
- [ ] 新機能が正しく動作するか
- [ ] 既存機能に影響がないか
- [ ] エラーが発生しないか
- [ ] UIが崩れていないか
- [ ] モバイル表示も確認（Chrome DevToolsで）

**ローカルアクセス：**
- http://localhost:3000

### 3. コミットとプッシュ

ローカルテストが完了したら、変更をコミットします。

```bash
# 変更をステージング
git add <変更したファイル>

# コミット（わかりやすいメッセージを）
git commit -m "add-help-page-with-welcome-guide"

# ブランチをプッシュ
git push origin feature/add-help-page
```

### 4. 本番デプロイ

#### 方法A: GitHubでマージ（推奨）

1. **GitHubでPull Requestを作成**
   - https://github.com/rougenoir214/keiba-yosou-site
   - 「Compare & pull request」をクリック
   - 変更内容を確認
   - 「Create pull request」

2. **変更内容を最終確認**
   - Files changed タブで差分を確認
   - 問題なければ「Merge pull request」

3. **mainブランチにマージ**
   - 「Confirm merge」
   - Renderが自動デプロイを開始（約2-3分）

#### 方法B: ローカルでマージ（緊急時）

```bash
# mainブランチに切り替え
git checkout main

# リモートの最新を取得
git pull origin main

# featureブランチをマージ
git merge feature/add-help-page

# mainにプッシュ
git push origin main
```

### 5. デプロイ確認

**Renderのダッシュボードで確認：**
1. https://dashboard.render.com
2. `keiba-yosou-site` を選択
3. 「Events」タブで「Deploy succeeded」を確認

**本番環境で動作確認：**
- https://keiba-yosou-site.onrender.com
- 修正内容が反映されているか確認
- エラーが発生していないか確認

---

## データベース操作

### Supabaseへのアクセス

**URL：** https://supabase.com
**プロジェクト：** keiba-yosou-site

### SQL実行時の注意

- **必ずバックアップを取る**（重要なデータの場合）
- **WHERE句を忘れない**（UPDATE/DELETE時）
- **トランザクションを活用**（複数のクエリを実行する場合）

```sql
-- 例：データ更新前に確認
SELECT * FROM bets WHERE id = 123;

-- 更新
UPDATE bets SET horses = '1>2,3' WHERE id = 123;

-- 確認
SELECT * FROM bets WHERE id = 123;
```

---

## トラブルシューティング

### ローカルサーバーが起動しない

```bash
# ポート3000が使用中の場合
netstat -ano | findstr :3000
taskkill /F /PID <PID番号>
```

### 本番環境でエラーが発生した場合

1. **Renderのログを確認**
   - Dashboard → Logs タブ
   - エラーメッセージを確認

2. **ロールバック**
   - GitHubでリバートコミットを作成
   - または、前のコミットに戻す

```bash
# 前のコミットに戻す
git revert HEAD
git push origin main
```

---

## ベストプラクティス

### コミットメッセージ

わかりやすく、具体的に書く：

✅ **良い例：**
- `fix-umatan-formation-delimiter-from-dash-to-greater-than`
- `add-help-page-with-accordion-and-welcome-guide`
- `improve-betting-ticket-display-remove-comma`

❌ **悪い例：**
- `fix bug`
- `update`
- `changes`

### コードレビュー

重要な変更の場合は、以下を確認：
- [ ] セキュリティリスクはないか
- [ ] パフォーマンスへの影響はないか
- [ ] エラーハンドリングは適切か
- [ ] ユーザー体験は向上しているか

---

## 重要なファイル

### サーバー起動
- `server.js` - メインサーバーファイル

### ルート
- `routes/races.js` - レース関連
- `routes/predictions.js` - 予想・馬券購入
- `routes/auth.js` - 認証・設定
- `routes/help.js` - ヘルプページ

### ビュー
- `views/races/` - レース画面
- `views/predictions/` - 予想画面
- `views/auth/` - 認証・設定画面

### スケジューラー
- `race-notification-scheduler.js` - プッシュ通知（本番環境のみ起動）

### データベース
- `db/pool.js` - DB接続設定
- `db/*.sql` - スキーマ定義

---

## 緊急時の連絡先

**管理者：** 山本裕大

**重要なサービス：**
- GitHub: https://github.com/rougenoir214/keiba-yosou-site
- Render: https://dashboard.render.com
- Supabase: https://supabase.com

---

最終更新：2026年1月26日
