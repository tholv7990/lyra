FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @lyra/render-service... build
EXPOSE 9200
CMD ["node", "apps/render-service/dist/main.js"]
