# 株価データ管理ガイド

## 概要

このアプリケーションは、実際の株価データを使用したトレード練習機能を提供します。
データは事前にサーバー側にキャッシュされ、ユーザーは即座にアクセスできます。

## アーキテクチャ

### 従来の問題点
- ユーザーがボタンを押すたびにYahoo Finance APIへリクエスト
- 10銘柄×5年分のダウンロードに時間がかかる（最低5秒）
- レート制限のリスク
- 外部APIの障害リスク

### 改善後の設計
```
1. 管理者が定期的にデータを更新
   └─> npm run update-stocks

2. データはサーバーのファイルシステムにキャッシュ
   └─> lib/data/cache/*.json

3. ユーザーはキャッシュから即座に取得
   └─> /api/stocks/cached (GET)
```

## セットアップ

### 1. 初回データ取得

```bash
npm run update-stocks
```

これにより以下のファイルが生成されます：
- `lib/data/cache/stocks.json` - 銘柄情報（10銘柄）
- `lib/data/cache/prices.json` - 価格データ（2020-01-01から現在まで）
- `lib/data/cache/meta.json` - メタ情報（更新日時、データ件数など）

### 2. データの確認

```bash
# メタ情報を確認
cat lib/data/cache/meta.json

# 出力例:
# {
#   "lastUpdated": "2026-01-27T12:34:56.789Z",
#   "stockCount": 10,
#   "priceCount": 12000,
#   "dateRange": {
#     "start": "2020-01-01",
#     "end": "2026-01-27"
#   }
# }
```

## データ更新

### 定期更新（推奨）

週1回または月1回、最新データに更新することを推奨します：

```bash
npm run update-stocks
```

### 自動更新（オプション）

cron jobやGitHub Actionsで自動化できます：

```yaml
# .github/workflows/update-stocks.yml
name: Update Stock Data
on:
  schedule:
    - cron: '0 0 * * 0' # 毎週日曜日 0:00
  workflow_dispatch: # 手動実行も可能

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run update-stocks
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: "chore: update stock data"
```

## 対象銘柄

現在、50銘柄のデータを取得しています。主要セクター別の内訳：

### 金融（7銘柄）
- 三菱UFJ、三井住友、みずほ、大和証券、野村、東京海上、MS&AD

### 自動車・輸送機器（7銘柄）
- トヨタ、ホンダ、日産、マツダ、スズキ、デンソー、ブリヂストン

### 電機（9銘柄）
- ソニー、パナソニック、日立、三菱電機、富士通、京セラ、キーエンス、ファナック、村田製作所、TDK

### IT・通信（5銘柄）
- ソフトバンクグループ、ソフトバンク、NTT、KDDI、楽天

### 小売（3銘柄）
- ファーストリテイリング、セブン&アイ、イオン

### 食品（3銘柄）
- アサヒ、キリン、味の素

### 医薬品（4銘柄）
- 武田薬品、第一三共、エーザイ、アステラス

### 化学（3銘柄）
- 信越化学、三菱ケミカル、花王

### 商社（5銘柄）
- 三菱商事、三井物産、伊藤忠、住友商事、丸紅

### その他（4銘柄）
- 任天堂、リクルート、三井不動産

銘柄を追加・変更する場合は、`scripts/update-stock-data.ts` の `POPULAR_STOCKS` 配列を編集してください。

## API エンドポイント

### GET /api/stocks/cached

キャッシュされた株価データを取得します。

**レスポンス例:**
```json
{
  "success": true,
  "stocks": [...],
  "prices": [...],
  "meta": {
    "lastUpdated": "2026-01-27T12:34:56.789Z",
    "stockCount": 10,
    "priceCount": 12000,
    "dateRange": {
      "start": "2020-01-01",
      "end": "2026-01-27"
    }
  },
  "count": 12000
}
```

**エラー時（キャッシュがない場合）:**
```json
{
  "success": false,
  "error": "キャッシュデータが見つかりません。管理者にデータ更新を依頼してください。",
  "hint": "npm run update-stocks を実行してください"
}
```

## トラブルシューティング

### Q: ユーザーが「データが見つかりません」エラーを受け取る

A: サーバー側でデータ更新が必要です：
```bash
npm run update-stocks
```

### Q: データ更新に失敗する

A: Yahoo Finance APIへのアクセスが制限されている可能性があります。
- VPNを使用している場合は無効化してみてください
- 時間を置いて再実行してください
- エラーメッセージを確認し、特定の銘柄で問題がある場合はその銘柄を除外してください

### Q: データが古くなっている

A: 定期的に `npm run update-stocks` を実行してください。
自動化する場合は上記のGitHub Actions設定を参照してください。

## パフォーマンス

### 従来（APIから直接ダウンロード）
- 初回ロード: 約5-10秒
- Yahoo Finance APIへのリクエスト: 10回
- レート制限リスク: 高

### 改善後（キャッシュから取得）
- 初回ロード: 約0.1-0.5秒
- Yahoo Finance APIへのリクエスト: 0回
- レート制限リスク: なし

## セキュリティ

- Yahoo Finance APIキーは不要（公開APIを使用）
- ユーザーデータは全てブラウザのIndexedDBにローカル保存
- サーバー側にユーザーデータは保存されません
