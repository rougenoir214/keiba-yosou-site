# Git ブランチワークフロー

## ブランチを切って作業する方法

### 1. ブランチ作成と変更のコミット

```bash
# 変更をステージング
git add .

# ブランチ作成
git checkout -b feature/機能名

# コミット
git commit -m "説明"

# プッシュ
git push -u origin feature/機能名
```

### 2. mainにマージ

```bash
# mainに切り替え
git checkout main

# マージ
git merge feature/機能名 --no-ff -m "Merge feature/機能名 into main"

# プッシュ
git push origin main
```

## ワンライナー版（推奨）

### ステップ1: ブランチ作成からプッシュまで

```bash
cd C:\Users\rouge\OneDrive\keiba-yosou-site && git add . && git checkout -b feature/機能名 && git commit -m "説明" && git push -u origin feature/機能名
```

### ステップ2: mainにマージ

```bash
cd C:\Users\rouge\OneDrive\keiba-yosou-site && git checkout main && git merge feature/機能名 --no-ff -m "Merge feature/機能名 into main" && git push origin main
```

## 例: 今回の修正

### ステップ1
```bash
cd C:\Users\rouge\OneDrive\keiba-yosou-site && git add . && git checkout -b feature/fix-payout && git commit -m "Fix payout and validation" && git push -u origin feature/fix-payout
```

### ステップ2
```bash
cd C:\Users\rouge\OneDrive\keiba-yosou-site && git checkout main && git merge feature/fix-payout --no-ff -m "Merge feature/fix-payout into main" && git push origin main
```

## スマホから切り戻す方法

1. GitHubアプリを開く
2. Commits タブ
3. "Merge feature/..." のコミットを探す
4. "..." メニュー → Revert this commit
5. Create pull request または Commit directly

## ブランチ削除（任意）

マージ後、不要なブランチを削除：

```bash
# ローカルブランチ削除
git branch -d feature/機能名

# リモートブランチ削除
git push origin --delete feature/機能名
```
