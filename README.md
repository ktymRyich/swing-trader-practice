# スイングトレード練習アプリ

過去の株価データを使って、スイングトレードの練習ができるiPhone向けPWAアプリです。

<!-- スクリーンショットをここに追加予定 -->

## 初回起動

```bash
# 依存パッケージをインストール
npm install

# 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開き、ニックネームを入力してログインします。

### iPhoneでPWAとして使う

1. 同じネットワーク上のiPhoneで http://192.168.x.x:3000 にアクセス
2. Safariの共有ボタンから「ホーム画面に追加」を選択

## 株価データの更新

株価データは初回起動時に自動取得されます。更新は**たまに**（月1回程度）以下のコマンドで実行してください：

```bash
npm run update-stock-data
```

## 技術スタック

Next.js 15 / React / TypeScript / TailwindCSS / SQLite / Lightweight Charts

## ライセンス

MIT
