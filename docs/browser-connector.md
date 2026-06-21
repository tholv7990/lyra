# Browser-automation connector (GoLogin + Playwright) — EXPERIMENTAL / FENCED

> ⚠️ **ToS-risk · own-accounts-only · not the customer publish path.**
> This drives a real logged-in browser profile to upload, instead of using a
> platform's official API. Every platform's ToS prohibits automated posting and
> anti-detect browsers; accounts driven this way can be shadowbanned or removed.
> Use it for **your own** accounts as an experiment. The official-API path
> (Postiz) remains the path for anything customer-facing.

## What it is

A second, **off-by-default** publisher inside `apps/connectors-service`, on its own
`/browser/*` routes (it does **not** touch the Postiz `publish` flow). It:

1. launches a **GoLogin** profile that's already logged into the target account,
2. attaches **Playwright** to that profile over CDP,
3. runs a per-platform upload script (`scripts/tiktok.upload.ts`, `youtube.upload.ts`).

The upload scripts are **best-effort skeletons** — the platforms' web UIs drift, so
the selectors need verifying/tuning against the live page, and expect captcha / 2FA /
"unusual activity" interruptions. Start with `dryRun: true` (opens the upload page,
sets file + caption, does **not** submit).

## Arm it

1. Install the optional deps (kept out of the default install on purpose):
   ```bash
   pnpm --filter @lyra/connectors-service add gologin playwright
   npx playwright install chromium
   ```
2. Set env on the `lyra-connectors` process (ecosystem.config.js):
   ```
   BROWSER_CONNECTOR_ENABLED=true
   GOLOGIN_API_TOKEN=<your GoLogin API token>
   ```
   then `pnpm --filter @lyra/connectors-service build && pm2 restart lyra-connectors`.

## Use (direct calls — it's not wired into the Lyra UI)

```bash
TOKEN=<CONNECTORS_SERVICE_TOKEN>

# Is it armed?
curl -s localhost:9100/browser/status -H "Authorization: Bearer $TOKEN"
# → {"enabled":true,"gologinConfigured":true,"platforms":["tiktok","youtube"]}

# Dry run (reaches the upload page, does NOT post)
curl -s localhost:9100/browser/publish -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"platform":"tiktok","profileId":"<gologin-profile-id>","mediaUrls":["https://…/clip.mp4"],"caption":"hello","dryRun":true}'
# → {"jobId":"…","status":"queued"}  — then poll:
curl -s localhost:9100/browser/jobs/<jobId> -H "Authorization: Bearer $TOKEN"
```

When `enabled` is false, `/browser/publish` returns 403 and nothing launches.

## Notes / limits

- **Per-account proxy:** to avoid the platform correlating accounts, each GoLogin
  profile should use its own residential proxy (configured in GoLogin).
- **YouTube script** stops after upload+title (the multi-step Studio publish wizard
  needs tuning) — it's a deliberate dry stop until you wire the remaining steps.
- No retries/queue/scheduling — it's a scaffold to iterate on, run one at a time.
- Surfacing it in the Lyra UI is intentionally **not** done; keep it off the
  customer path until you've decided it's worth the risk.
