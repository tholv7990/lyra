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
2. attaches **Puppeteer** (`puppeteer-core`) to that profile over CDP,
3. runs a per-platform upload script (`scripts/{tiktok,youtube,facebook,instagram}.upload.ts`).

The upload scripts are **best-effort skeletons** — the platforms' web UIs drift, so
the selectors need verifying/tuning against the live page, and expect captcha / 2FA /
"unusual activity" interruptions. Start with `dryRun: true` (opens the upload page,
sets file + caption, does **not** submit).

## Arm it

1. Install the optional deps (kept out of the default install on purpose).
   `puppeteer-core` pulls **no** bundled Chromium — we attach to GoLogin's Orbita:
   ```bash
   pnpm --filter @lyra/connectors-service add gologin puppeteer-core
   ```
2. Set env on the `lyra-connectors` process (ecosystem.config.js):
   ```
   BROWSER_CONNECTOR_ENABLED=true
   GOLOGIN_API_TOKEN=<your GoLogin API token>
   ```
   then `pnpm --filter @lyra/connectors-service build && pm2 restart lyra-connectors`.

## Two modes (publish takes exactly one of these)

- **`profileId`** — **SDK-launch** (production). GoLogin opens that profile, posts,
  then stops it. Unattended + scalable; needs `GOLOGIN_API_TOKEN`.
- **`wsEndpoint`** — **attach** (dev/tuning). You open the profile yourself in the
  GoLogin desktop app, copy its CDP endpoint, and Puppeteer attaches to it. No
  token/SDK, and your browser stays open — best for tuning selectors and clearing
  captchas/2FA by hand. Use this to get a script working, then switch to `profileId`.

Sending both, or neither, is a 400.

## Use (direct calls — it's not wired into the Lyra UI)

```bash
TOKEN=<CONNECTORS_SERVICE_TOKEN>

# Is it armed?
curl -s localhost:9100/browser/status -H "Authorization: Bearer $TOKEN"
# → {"enabled":true,"gologinConfigured":true,"platforms":["tiktok","youtube","facebook","instagram"]}

# A) SDK-launch by profile id (production path)
curl -s localhost:9100/browser/publish -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"platform":"tiktok","profileId":"<gologin-profile-id>","mediaUrls":["https://…/clip.mp4"],"caption":"hello","dryRun":true}'

# B) Attach to a profile you opened in the GoLogin app (dev/tuning)
#    (get the ws endpoint from the GoLogin app's automation/debug, e.g. ws://127.0.0.1:<port>…)
curl -s localhost:9100/browser/publish -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"platform":"tiktok","wsEndpoint":"ws://127.0.0.1:<port>/devtools/browser/<id>","mediaUrls":["https://…/clip.mp4"],"caption":"hello","dryRun":true}'

# → {"jobId":"…","status":"queued"}  — then poll:
curl -s localhost:9100/browser/jobs/<jobId> -H "Authorization: Bearer $TOKEN"
```

Attach mode needs neither `GOLOGIN_API_TOKEN` nor the `gologin` package — only
`puppeteer-core` (the connector still has to be `BROWSER_CONNECTOR_ENABLED=true`).
When `enabled` is false, `/browser/publish` returns 403 and nothing launches.

## Notes / limits

- **Per-account proxy:** to avoid the platform correlating accounts, each GoLogin
  profile should use its own residential proxy (configured in GoLogin).
- **Per-platform tuning:** all scripts are best-effort skeletons — selectors drift,
  so run `dryRun:true` first and adjust against the live UI.
  - **YouTube** stops after upload+title (the multi-step Studio publish wizard needs
    wiring) — a deliberate dry stop.
  - **Facebook** targets the personal feed; for a Page, `goto` the Page URL first.
  - **Instagram** walks the New-post dialog (select ▸ crop ▸ edit ▸ caption ▸ share);
    the two "Next" steps + caption box are the most drift-prone.
- No retries/queue/scheduling — it's a scaffold to iterate on, run one at a time.
- Surfacing it in the Lyra UI is intentionally **not** done; keep it off the
  customer path until you've decided it's worth the risk.
