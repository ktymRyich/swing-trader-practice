#!/bin/bash
# EC2初回セットアップスクリプト
# 使い方: ssh経由でEC2に接続後、このスクリプトを実行

set -e

echo "===== Swing Trader Practice EC2セットアップ ====="

# Node.js 20のインストール
echo "📦 Node.js 20をインストール中..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "✓ Node.js $(node --version) インストール完了"
echo "✓ npm $(npm --version) インストール完了"

# PM2のインストール
echo "📦 PM2をインストール中..."
sudo npm install -g pm2

echo "✓ PM2インストール完了"

# アプリケーションディレクトリの作成
echo "📁 アプリケーションディレクトリを作成中..."
mkdir -p ~/swing-trader-practice/data/users
mkdir -p ~/swing-trader-practice/data/sessions
cd ~/swing-trader-practice

# .env.localファイルの生成
echo "🔐 環境変数ファイルを作成中..."

# JWT_SECRETの生成
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# .env.localファイルの作成
cat > .env.local << EOF
# JWT認証用のシークレットキー（自動生成）
JWT_SECRET=${JWT_SECRET}

# Basic認証の設定
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=swingtrade

# 本番環境では必ずfalse
SKIP_BASIC_AUTH=false
EOF

echo "✓ .env.local作成完了"
echo ""
echo "⚠️  重要: Basic認証のパスワードを変更してください！"
echo "   nano .env.local"
echo "   BASIC_AUTH_PASSWORD=swingtrade を強力なパスワードに変更"
echo ""

# PM2の自動起動設定
echo "🚀 PM2の自動起動を設定中..."
pm2 startup systemd -u $USER --hp $HOME | grep "sudo" | bash

echo "✓ PM2自動起動設定完了"
echo ""
echo "===== セットアップ完了 ====="
echo ""
echo "次のステップ："
echo "1. GitHubリポジトリにSecretsを設定"
echo "   - EC2_SSH_KEY: EC2のプライベートキー"
echo "   - EC2_HOST: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "   - EC2_USER: ubuntu"
echo ""
echo "2. .env.localのパスワードを変更"
echo "   nano ~/swing-trader-practice/.env.local"
echo ""
echo "3. mainブランチにpushしてデプロイ開始"
echo ""
