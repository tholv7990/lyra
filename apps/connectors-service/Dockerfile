FROM node:20-slim
# Deno powers yt-dlp's [jsc:deno] solver, which passes YouTube's nsig JS challenge
# (the bin image is just the standalone deno binary at /deno).
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl python3 \
  # yt-dlp NIGHTLY: the [jsc:deno] JS-challenge support is nightly-only (>=2026.06.18)
  # until it lands in stable; nightly also keeps extractors current. Rebuild to update.
  && curl -L https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# (Monorepo build context: copy + install + build the workspace, or mount a prebuilt dist.)
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @lyra/connectors-service... build
EXPOSE 9100
CMD ["node", "apps/connectors-service/dist/main.js"]
