# EC2デプロイガイド

## 1. GitHub Secretsの設定

GitHubリポジトリで以下のSecretsを設定してください：

**Settings → Secrets and variables → Actions → New repository secret**

1. **EC2_SSH_KEY**
    - EC2のプライベートキー（.pemファイルの内容）
    - 値：`swingtrade20260216.pem`の中身全体をコピー

2. **EC2_HOST**
    - EC2インスタンスのパブリックIPアドレス
    - 例：`54.123.456.78`

3. **EC2_USER**
    - EC2のユーザー名
    - Ubuntu AMIの場合：`ubuntu`
    - Amazon Linux 2の場合：`ec2-user`

## 2. EC2の初期セットアップ

EC2に初回のみ以下のセットアップを実行：

```bash
# EC2にSSH接続
ssh -i swingtrade20260216.pem ubuntu@YOUR_EC2_IP

# Node.js 20のインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2のインストール（プロセス管理ツール）
sudo npm install -g pm2

# アプリケーションディレクトリの作成
mkdir -p /home/ubuntu/swing-trader-practice
cd /home/ubuntu/swing-trader-practice

# .env.localファイルの作成
nano .env.local
```

### .env.localの内容（本番環境用）

```bash
# 強力なランダムなシークレットキーを生成（64文字以上）
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Basic認証の設定（強力なパスワードに変更）
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# 本番環境では必ずfalse
SKIP_BASIC_AUTH=false
```

### PM2の自動起動設定

```bash
# PM2をシステム起動時に自動起動
pm2 startup systemd
# 表示されたコマンドを実行（sudo ...）

# 現在の状態を保存
pm2 save
```

## 3. デプロイ方法

### 自動デプロイ（推奨）

mainブランチにpushすると自動的にデプロイされます：

```bash
git add .
git commit -m "デプロイ"
git push origin main
```

GitHubの「Actions」タブでデプロイの進行状況を確認できます。

### 手動デプロイ

GitHub Actionsの画面から手動でトリガーすることもできます：

1. GitHubリポジトリの「Actions」タブを開く
2. 左側の「Deploy to EC2」を選択
3. 「Run workflow」ボタンをクリック

## 4. アプリケーションの確認

デプロイ後、以下のコマンドでアプリケーションの状態を確認：

```bash
# EC2にSSH接続
ssh -i swingtrade20260216.pem ubuntu@YOUR_EC2_IP

# PM2の状態確認
pm2 status

# ログの確認
pm2 logs swing-trader

# アプリケーションの再起動
pm2 restart swing-trader

# アプリケーションの停止
pm2 stop swing-trader
```

## 5. ブラウザからアクセス

```
http://YOUR_EC2_IP:3000
```

Basic認証のユーザー名とパスワードを入力してアクセスします。

## 6. トラブルシューティング

### ビルドが失敗する場合

GitHub Actionsのログを確認：

- GitHubの「Actions」タブ → 失敗したワークフローをクリック → ログを確認

### デプロイ後にアプリが起動しない場合

```bash
# EC2でログを確認
pm2 logs swing-trader --lines 100

# Node.jsのバージョン確認
node --version  # 20.x以上であることを確認

# ポート3000が使用中か確認
sudo lsof -i :3000

# 手動で起動してエラーを確認
cd /home/ubuntu/swing-trader-practice
npm start
```

### データベースファイルが見つからない場合

```bash
# EC2でディレクトリを作成
mkdir -p /home/ubuntu/swing-trader-practice/data/users
mkdir -p /home/ubuntu/swing-trader-practice/data/sessions

# ローカルからデータをコピー（必要な場合）
scp -i swingtrade20260216.pem data/users/*.json ubuntu@YOUR_EC2_IP:/home/ubuntu/swing-trader-practice/data/users/
```

## 7. セキュリティグループの設定

EC2のセキュリティグループで以下のポートを開放：

- **SSH (22)**: あなたのIPアドレスのみ許可
- **HTTP (3000)**: 0.0.0.0/0（全体に公開）または特定のIPのみ

後でNginxを使ってHTTPS（443）に移行することを推奨します。
