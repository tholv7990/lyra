# Plan — crawler + ops pending tasks — June 20, 2026

Plans for the parked items after the Crawler quality+progress+TikTok work shipped
(`fa5f645`, `6907847` on origin/dev). None started — pick up with the user.

---

## A. Durability — stop running dev off the worktree + detached procs

**Problem:** dev.getlyras.app tunnels to `:5173/:3001/:9100`, all started as **detached
`Start-Process` node** off the **worktree** (`feat/members-page`). Won't survive a
reboot; main `codex-dev` tree is behind `origin/dev`; the connectors Dockerfile can't
do the JS-challenge.

**A1 — make the main tree canonical (low risk).**
- In the **main tree** (`c:/Users/Admin/Desktop/Lyra`, branch `codex-dev`):
  `git fetch && git merge origin/dev` (origin/dev = `6907847`; should be clean — it's
  ahead of codex-dev with no divergence). Coordinate with the concurrent Codex agent
  first (it shares this tree; see `[[concurrent-codex-claude-tree]]`).
- Rebuild + run the three servers from the **main tree**, not the worktree. Then the
  worktree is just for editing.

**A2 — survive reboot (ops).**
- Wrap the three servers in a process manager so they auto-restart:
  - Lazy/native: **pm2** (`pm2 start … && pm2 save && pm2-installer` for a Windows
    service) — one ecosystem file with web/api/connectors, env + PATH (yt-dlp+ffmpeg+deno)
    baked in. Names the `:9100` PATH problem once.
  - Or **nssm** to register each as a Windows service.
- Either removes the "PIDs change / dies on reboot / PATH not set" recipe entirely.

**A3 — connectors Dockerfile: Deno + nightly yt-dlp (for any future container deploy).**
`apps/connectors-service/Dockerfile` currently pulls yt-dlp *stable* `latest` and has
no Deno → it would fail YouTube's JS challenge. Edits:
- Install **Deno** (e.g. `curl -fsSL https://deno.land/install.sh | sh` → put
  `/root/.deno/bin` on PATH, or copy from `denoland/deno:bin` stage).
- Switch yt-dlp to the **nightly** asset (the JS-challenge `[jsc:deno]` support is in
  nightly ≥ 2026.06.18): pull from
  `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp`
  (pin a version for reproducibility; revisit when it lands in stable).
- ponytail: keep it a plain `RUN curl …`; no multi-stage gymnastics unless the image
  size actually hurts.
- Verify in-container: `yt-dlp -v --simulate <jsc video>` shows `[jsc:deno]`.

---

## B. Crawler cookie support — logged-in / age-gated / region videos

**Why:** some videos need the user's session (private/age-gated) or a region the
server isn't in (region locks are **IP-based → a proxy, not cookies, fixes those** —
out of scope). yt-dlp supports `--cookies <file>` (Netscape format) or
`--cookies-from-browser <browser>` (needs a real browser profile on the box →
impractical for the service).

**Recommended: per-workspace uploaded `cookies.txt`, treated as a secret.**
- **Storage:** reuse the encrypted-key pattern — a per-(workspace, site) cookie blob,
  AES-256-GCM at rest (cookies ARE credentials → invariant-7-class handling; never
  log, never return). Likely a new small collection or an extension of the keys store.
- **Plumbing:** `resolve`/`download` DTOs gain an optional opaque `credentialId`; the
  connectors-service writes the decrypted cookie file to the job's temp dir and passes
  `--cookies <path>`; delete with the temp dir (already TTL-swept).
- **UI:** a "Use my login (upload cookies.txt)" affordance on the Crawler, gated +
  warned ("only for content you have rights to").
- **⚠️ Security:** cookies are session secrets — `security-reviewer` pass required;
  SSRF/path-traversal review on the temp file write; ensure the file is workspace-scoped
  and never readable cross-tenant.
- **Effort:** medium. Phase it: (1) connectors-service `--cookies` plumbing behind an
  opaque path arg (no storage yet), (2) encrypted per-workspace storage + UI.

**Cheaper interim:** operator-level single `COOKIES_FILE` env on the connectors-service
(one shared session) — fine for a single-tenant/personal deploy, **not** for
multi-tenant (shared session = shared identity). Document the limitation.

---

## C. Progress-bar polish — one smooth % across the video+audio passes

**Problem:** for merged formats (`bv+ba`) yt-dlp downloads two files, so the bar ramps
0→100 twice then merges. Today the web shows the latest per-file pct.

**Fix (clean heuristic, in the connectors-service progress parse):**
- yt-dlp prints `[info] <id>: Downloading 1 format(s): 399+251` → the count of
  `+`-joined ids is the **number of files** (`N`); progressive single format → `N=1`.
- Track the current file index via `[download] Destination: …` lines (increment per
  Destination). Compute **overall = (fileIdx + curPct/100) / N × 100** and report THAT
  as the job `pct` (monotonic, ends at 100 on `done`).
- Edge cases: unknown/None filesize → clamp; merge phase → keep at ~99 until `done`;
  if the `format(s)` line is absent (some sites), fall back to current behavior (latest
  pct). ponytail: name the fallback in a comment.
- **Files:** `apps/connectors-service/src/download/ytdlp.ts` (`parsePercents` →
  a small stateful `progressTracker`), `download.service.ts` (use it in `runJob`). No
  web/api change — the job `pct` just gets smoother. Unit-test the tracker
  (1 file → passthrough; 2 files → 0/50/100 mapping; missing format line → fallback).

---

## D. Housekeeping
- `git gc` (or `git prune`) in the repo — clears the recurring "too many unreachable
  loose objects" warning. Safe, do when convenient.

---

## Suggested order
C (small, finishes the shipped feature nicely) → A1+A3 (cheap durability + deploy
readiness) → A2 (process manager) → B (cookies, biggest + security-gated). D anytime.
