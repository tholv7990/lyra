FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl python3 \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# (Monorepo build context: copy + install + build the workspace, or mount a prebuilt dist.)
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @lyra/connectors-service... build
EXPOSE 9100
CMD ["node", "apps/connectors-service/dist/main.js"]
