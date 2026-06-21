# Connecting TikTok / YouTube / Instagram / X (via Postiz)

These platforms are **implemented by Postiz**, not by Lyra — Postiz owns every OAuth
flow and the actual posting. There is **no Lyra code** to add. Turning a platform "on"
means: register a developer app on that platform → set its redirect URI → drop the
OAuth client id/secret into Postiz's env → recreate the Postiz container.

The env vars are already wired in [`docker-compose.yml`](../docker-compose.yml)
(`${X_API_KEY:-}`, `${TIKTOK_CLIENT_ID:-}`, …); fill them in the compose `.env`.
Empty = the provider stays hidden, so you can enable them one at a time.

**Redirect URI pattern (all providers):**
`https://postiz.getlyras.app/integrations/social/<provider>`
(must be HTTPS and publicly reachable — i.e. the tunnel hostname, never localhost.)

After editing `.env`, **recreate Postiz** (env changes need a container recreate):

```bash
docker compose --profile connectors up -d postiz
```

---

## X (Twitter)

- **Portal:** https://developer.twitter.com/en/portal/dashboard (free dev account ok)
- **App type:** **Native App** (Web App / Automated / Bot will *fail* auth)
- **Permissions:** Read **and** Write
- **Callback URI:** `https://postiz.getlyras.app/integrations/social/x`
- **Creds:** "Keys and Tokens" → Consumer Keys → `X_API_KEY`, `X_API_SECRET`
- **Notes:** Postiz uses OAuth 1.0a (image upload) + OAuth2 (v2 API). Basic posting works on the free tier; analytics may need a paid tier.

## TikTok

- **Portal:** https://developers.tiktok.com/apps
- **Products:** **Login Kit** + **Content Posting API** (enable **Direct Post**)
- **Scopes:** `user.info.basic`, `user.info.profile`, `video.create`, `video.upload`, `video.publish`
- **Callback URI:** `https://postiz.getlyras.app/integrations/social/tiktok`
- **Creds:** `TIKTOK_CLIENT_ID` (16 chars), `TIKTOK_CLIENT_SECRET` (32 chars)
- **Notes:** Requires a public HTTPS domain you can verify (file upload), and media must be public HTTPS (no localhost). **Until TikTok audits the app, posts are private-only, capped at 5 users / 24h.** Audit/review required for public posting.

## YouTube

- **Portal:** https://console.cloud.google.com → create a project
- **Enable APIs:** YouTube Data API v3 (+ Analytics + Reporting)
- **OAuth:** configure the consent screen, then create an **OAuth 2.0 client → Web application**
- **Callback URI:** `https://postiz.getlyras.app/integrations/social/youtube`
- **Creds:** `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- **Notes:** Add yourself as a **test user** while the consent screen is unverified. Going "External"/public, or Brand/Workspace accounts, needs Google verification (Workspace trusted-app + ~5h propagation). Uploads count against the Data API quota (a real upload is ~1600 units; default quota is 10k/day → request more if you post a lot).

## Instagram

- **Portal:** https://developers.facebook.com/apps → new app, type **Other → Business**
- **Product:** add **Instagram**, set up **Instagram Business Login**
- **Account:** a **professional** IG account (standalone), or an IG account linked to a **Facebook Business page** (Facebook path)
- **Callback URIs:**
  - standalone: `https://postiz.getlyras.app/integrations/social/instagram-standalone` → `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`
  - via Facebook page: `https://postiz.getlyras.app/integrations/social/instagram` → `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`
- **Permissions:** `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`
- **Notes:** Public use needs **Meta business verification + app review**. For testing without review, add the IG account as an **Instagram Tester** and accept the invite from the account's settings.

---

## Reality check on timelines

- **Same day:** Bluesky / Mastodon (no review), and *testing* TikTok/YouTube/Instagram against your own account (tester/sandbox mode, private/limited posting).
- **Days–weeks:** public posting on TikTok (audit), Instagram (business verification + app review), YouTube (consent-screen verification). These are platform approvals — outside our control; Postiz just provides the flows.

## Verify after enabling one

In Lyra → Connections → "Manage channels in Postiz" opens `https://postiz.getlyras.app`;
the newly-configured provider now appears there to connect. Once connected, the channel
shows in Lyra's pool → selectable on a project → publishable.
