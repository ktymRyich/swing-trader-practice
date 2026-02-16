# PM2を使ったEC2デプロイ手順

## 前提条件

- `npm start` が実行可能な状態
- プロジェクトのビルドが完了している（`npm run build`）

## 1. 初回セットアップ（初回のみ）

### EC2でNode.jsとPM2をインストール

```bash
# setup-ec2.shを実行（初回のみ）
bash scripts/setup-ec2.sh
```

このスクリプトは以下を実行します：

- Node.js 20のインストール
- PM2のグローバルインストール
- PM2の自動起動設定
- 環境変数ファイルの作成

## 2. アプリケーションのデプロイ

### ビルドを実行

```bash
npm run build
```

### PM2でアプリケーションを起動

```bash
# ecosystem.config.jsを使用して起動
pm2 start ecosystem.config.js

# または直接起動
pm2 start npm --name "swing-trader-practice" -- start
```

## 3. PM2管理コマンド

### 状態確認

```bash
# アプリケーション一覧を表示
pm2 list

# 詳細情報を表示
pm2 show swing-trader-practice

# ログをリアルタイムで表示
pm2 logs swing-trader-practice

# ログの最後の部分を表示
pm2 logs swing-trader-practice --lines 100
```

### アプリケーション管理

```bash
# 再起動
pm2 restart swing-trader-practice

# 停止
pm2 stop swing-trader-practice

# 削除（PM2から登録解除）
pm2 delete swing-trader-practice

# すべてのアプリを再起動
pm2 restart all
```

### 設定を保存して自動起動

```bash
# 現在のPM2プロセスリストを保存
pm2 save

# 自動起動を有効化（初回のみ）
pm2 startup
# 表示されたコマンドをコピーして実行
```

## 4. デプロイ後の更新手順

コードを更新した場合：

```bash
# 最新のコードを取得
git pull origin main

# 依存関係を更新（package.jsonが変更された場合）
npm install

# ビルド
npm run build

# PM2でアプリを再起動
pm2 restart swing-trader-practice

# または設定ファイルから再起動
pm2 restart ecosystem.config.js
```

## 5. モニタリング

### PM2モニタリング画面

```bash
# リアルタイムモニタリング
pm2 monit
```

### ログファイルの場所

- エラーログ: `./logs/pm2-error.log`
- 出力ログ: `./logs/pm2-out.log`

### ログを確認

```bash
# ログディレクトリを作成（初回）
mkdir -p logs

# ログをフォロー
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log
```

## 6. トラブルシューティング

### アプリが起動しない場合

```bash
# ログを確認
pm2 logs swing-trader-practice --err

# 詳細情報を確認
pm2 describe swing-trader-practice

# 環境変数を確認
pm2 env 0  # 0はプロセスID
```

### メモリリークの場合

```bash
# メモリ使用量を確認
pm2 list

# ecosystem.config.jsのmax_memory_restartが効いているか確認
# デフォルトは1GB
```

### ポート3000が使用中の場合

```bash
# ポートを使用しているプロセスを確認
sudo lsof -i :3000

# 別のポートを使用する場合はecosystem.config.jsを編集
# env.PORTを変更
```

## 7. セキュリティ

### Basic認証の設定

`.env.local`ファイルでBasic認証を設定できます：

```bash
nano .env.local
```

必ず`BASIC_AUTH_PASSWORD`を強力なパスワードに変更してください。

### ファイアウォール設定

```bash
# UFWでポート3000を開放
sudo ufw allow 3000/tcp
sudo ufw enable
```

## 8. 便利なエイリアス（オプション）

`~/.bashrc`に追加すると便利：

```bash
# PM2エイリアス
alias pm2-restart='pm2 restart swing-trader-practice'
alias pm2-logs='pm2 logs swing-trader-practice'
alias pm2-status='pm2 list'

# 再読み込み
source ~/.bashrc
```

## ecosystem.config.js設定の説明

現在の設定：

- **name**: アプリケーション名
- **script**: 実行スクリプト（npm）
- **args**: スクリプト引数（start）
- **instances**: プロセス数（1 = シングルプロセス）
- **autorestart**: 自動再起動を有効化
- **watch**: ファイル監視（本番では無効）
- **max_memory_restart**: メモリ上限で自動再起動
- **env**: 環境変数（NODE_ENV, PORT）

クラスター化する場合は`instances: 'max'`に変更できます。
