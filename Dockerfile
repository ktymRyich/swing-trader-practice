# マルチステージビルド
FROM node:20-alpine AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# アプリケーションのコピー
COPY . .

# ビルド実行
RUN npm run build

# 本番環境イメージ
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 本番用の依存関係のみインストール
COPY package*.json ./
RUN npm ci --omit=dev

# ビルド成果物をコピー
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

# データディレクトリの作成
RUN mkdir -p /app/data/users /app/data/sessions

# ポート公開
EXPOSE 3000

# アプリケーション起動
CMD ["npm", "start"]
