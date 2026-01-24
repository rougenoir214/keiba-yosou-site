# プッシュ通知機能 セットアップガイド

## 段階1: 基本的なプッシュ通知のセットアップ（完了）

このガイドでは、プッシュ通知機能を有効化する手順を説明します。

## 前提条件

- Node.js 20以上
- PostgreSQLデータベース
- HTTPS環境（ローカル開発ではlocalhostで可）

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

新しく追加されたパッケージ:
- `web-push`: Web Push Protocol実装
- `node-schedule`: スケジューリング（段階2で使用）

### 2. VAPIDキーの生成

プッシュ通知に必要なVAPIDキーを生成します。

```bash
node generate-vapid-keys.js
```

出力された`VAPID_PUBLIC_KEY`と`VAPID_PRIVATE_KEY`をコピーします。

### 3. 環境変数の設定

`.env`ファイルに以下を追加します:

```env
# プッシュ通知設定
VAPID_PUBLIC_KEY=生成された公開鍵をここに貼り付け
VAPID_PRIVATE_KEY=生成された秘密鍵をここに貼り付け
VAPID_SUBJECT=mailto:your-email@example.com
```

⚠️ **重要**: 
- VAPIDキーは一度設定したら変更しないでください
- 本番環境と開発環境で同じキーを使用してください
- キーを変更すると既存のプッシュ購読がすべて無効になります

### 4. データベースの更新

プッシュ購読情報を保存するテーブルを作成します。

**ローカル環境（PostgreSQL）の場合:**
```bash
psql -U your_username -d keiba_yosou -f db/add_push_subscriptions.sql
```

**本番環境（Supabase）の場合:**
Supabaseのダッシュボードで、SQLエディタから`db/add_push_subscriptions.sql`の内容を実行します。

### 5. サーバーの再起動

```bash
# ローカル環境
npm run dev

# 本番環境（Render）
git add .
git commit -m "プッシュ通知機能の追加（段階1）"
git push origin main
```

### 6. 動作確認

1. ブラウザで http://localhost:3000 にアクセス
2. ログイン後、「設定」ページに移動
3. 「プッシュ通知」セクションで「有効にする」ボタンをクリック
4. ブラウザの通知許可ダイアログで「許可」を選択
5. 「テスト送信」ボタンをクリックして通知が届くか確認

## トラブルシューティング

### 通知が届かない場合

1. **ブラウザの通知が許可されているか確認**
   - Chrome: 設定 > プライバシーとセキュリティ > サイトの設定 > 通知
   - Firefox: 設定 > プライバシーとセキュリティ > 許可設定 > 通知
   - Safari: 設定 > Webサイト > 通知

2. **HTTPSで動作しているか確認**
   - ローカル開発では`localhost`でOK
   - 本番環境では必ずHTTPSが必要

3. **Service Workerが登録されているか確認**
   - ブラウザの開発者ツール > Application > Service Workers

4. **VAPIDキーが正しく設定されているか確認**
   ```bash
   # .envファイルを確認
   cat .env | grep VAPID
   ```

### よくあるエラー

**エラー: "VAPID公開キーが見つかりません"**
- `.env`ファイルに`VAPID_PUBLIC_KEY`が設定されているか確認
- サーバーを再起動したか確認

**エラー: "購読情報の保存に失敗しました"**
- データベーステーブルが作成されているか確認
- データベース接続が正常か確認

**エラー: "このブラウザはプッシュ通知をサポートしていません"**
- 古いブラウザの可能性があります
- Chrome、Firefox、Edgeの最新版を使用してください

## 次のステップ

段階1が完了したら、次は段階2「レース発走時刻チェックの仕組み」に進みます。

段階2では以下を実装します:
- 定期的にレースをチェックするcronジョブ
- 発走30分前のレースを検出
- 該当レースのプッシュ通知送信

## 技術詳細

### ファイル構成

```
keiba-yosou-site/
├── public/
│   ├── push-notifications.js    # フロントエンド用スクリプト
│   └── service-worker.js        # Service Worker（プッシュイベント処理追加）
├── routes/
│   └── push.js                  # プッシュ通知API
├── db/
│   └── add_push_subscriptions.sql  # DBテーブル作成SQL
├── views/
│   └── auth/
│       └── settings.ejs         # 設定ページ（プッシュ通知UI追加）
├── generate-vapid-keys.js       # VAPIDキー生成スクリプト
└── server.js                    # プッシュ通知ルート追加
```

### API エンドポイント

- `POST /api/push/subscribe` - プッシュ通知を購読
- `POST /api/push/unsubscribe` - プッシュ通知を解除
- `POST /api/push/test-send` - テスト通知を送信

### データベーススキーマ

```sql
CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);
```

## 参考リンク

- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push ライブラリ](https://github.com/web-push-libs/web-push)
