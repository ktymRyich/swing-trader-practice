# スイングトレード練習アプリ

過去の株価データを使って、スイングトレードの練習ができるiPhone向けPWAアプリです。

<!-- スクリーンショットをここに追加予定 -->

## 初回起動

```bash
# 依存パッケージをインストール
npm install

# 環境変数の設定
cp .env.example .env.local
# .env.local を編集して以下を変更：
# - JWT_SECRET: ランダムな64文字以上の文字列
# - BASIC_AUTH_USER: Basic認証のユーザー名
# - BASIC_AUTH_PASSWORD: Basic認証のパスワード

# 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

**開発環境では：**

- Basic認証はスキップされます（SKIP_BASIC_AUTH=true）
- ログイン画面でニックネームとパスワードを入力

**本番環境では：**

1. Basic認証ダイアログが表示（アプリ全体を保護）
2. その後、ログイン画面でユーザー認証

### iPhoneでPWAとして使う

1. 同じネットワーク上のiPhoneで http://192.168.x.x:3000 にアクセス
2. Safariの共有ボタンから「ホーム画面に追加」を選択

## セキュリティ設定

このアプリは2段階の認証で保護されています：

### 1. Basic認証（第1層）

- アプリ全体への最初のアクセスを保護
- ブラウザが認証情報を記憶（1度入力すればOK）
- `.env.local` で設定:
    ```bash
    BASIC_AUTH_ENABLED=true
    BASIC_AUTH_USER=your-username
    BASIC_AUTH_PASSWORD=your-password
    ```

### 2. JWT + パスワード認証（第2層）

- ユーザーごとの個別認証
- パスワードはbcryptでハッシュ化して保存
- 30日間有効なJWTトークンで認証状態を管理

### 本番環境へのデプロイ前チェックリスト

- [ ] `.env.local` のJWT_SECRETを強力なランダム文字列に変更
- [ ] BASIC_AUTH_USER と BASIC_AUTH_PASSWORD を変更
- [ ] SKIP_BASIC_AUTH=false に設定
- [ ] `.env.local` がGitにコミットされていないことを確認

## 株価データの更新

株価データは初回起動時に自動取得されます。更新は**たまに**（月1回程度）以下のコマンドで実行してください：

```bash
npm run update-stock-data
```

## 技術スタック

Next.js 15 / React / TypeScript / TailwindCSS / SQLite / Lightweight Charts / JWT / bcrypt

## デプロイ

AWS EC2へのデプロイ方法は [DEPLOY.md](./DEPLOY.md) を参照してください。

GitHub Actionsで自動的にビルドとデプロイが行われます：

- mainブランチにpush → 自動デプロイ実行
- GitHub Actionsでビルド → EC2に転送 → PM2で再起動

## ライセンス

MIT
