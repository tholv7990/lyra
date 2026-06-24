# Lyra — Design Brief for Design Agents

> **Purpose.** A single document a design agent (Figma, Claude, or a human designer) can read to design Lyra screens that are **correct on business** (right UX because the agent understands what Lyra does, who uses it, and the rules that shape every flow) and **correct on interface** (right UI because the agent uses Lyra's real design tokens, components, and affordance rules).
>
> Written in two voices: a **business analyst** (Parts 1–2: features, flows, data fields) and a **UI/UX designer** (Part 3: design system). Part 4 is a ready-to-paste prompt for the design agent.
>
> **Source of truth.** Distilled from the code (`packages/shared`, `apps/web`, `apps/api`) and docs (`docs/lyra-pipelines.md`, `docs/lyra-requirements.md`, `docs/notion-design.md`). Where this doc and `CLAUDE.md` disagree on visual style, **this doc wins** — the UI migrated to **Notion** (warm-neutral + blue), so the "Linear / orange `#FF6B1A`" notes in `CLAUDE.md` and `docs/lyra-linear-audit.md` are **superseded**.

---

## Part 0 — How to use this brief

1. Read **Part 1** to understand the job-to-be-done and the user before sketching anything. A pretty screen that ignores gates, key-gating, or visibility rules is wrong.
2. Read **Part 2** for the exact fields and enum values that drive on-screen elements (badges, status columns, filters, pills). Never invent a status that isn't in an enum here.
3. Read **Part 3** for the tokens, components, and affordance rules. **Never hardcode a color or roll a new control** when a token/component exists.
4. Use **Part 4** as the prompt skeleton when you hand a specific screen to a design agent.

---

# PART 1 — BUSINESS & PRODUCT (Business-Analyst view)

## 1.1 What Lyra is (elevator pitch)

Lyra is a **multi-user web app for e-commerce / dropshipping teams** to do two jobs in one workspace:

1. **Find & validate winning products** — run an agentic **product-research** pipeline that searches real sources, scores the opportunity on 10 weighted dimensions, computes unit economics, screens risk, and produces an **explainable decision** (TEST_NOW … REJECT) backed by cited evidence — never a naked number.
2. **Produce on-brand creative** — compose and run **AI creative pipelines** (find → crawl → brief → insight → prompts → images → video → assemble/QA) that generate on-brand images and UGC/video, with **human approval gates** at key steps, then publish to social channels.

The connective tissue is a **composable pipeline engine**: teams build reusable, linear pipelines from library **Prompts** bound to a chosen **provider·model**, assign them to **Projects**, and **run** them with live status and gate approvals. Everything is **evidence-first and explainable** — the product's personality is calm clarity, not flash.

## 1.2 Users, roles & access (who you're designing for)

**Tenancy.** The unit of access and ownership is the **Workspace** (personal, auto-created on signup; or team, admin-upgraded). Every project, prompt, pipeline, key, run, and asset belongs to a workspace. Users switch workspace context without re-login.

**Roles** (`Role` enum — these gate what controls a user even sees):

| Role | Can do | UX implication |
|---|---|---|
| `owner` | Everything; sees **all** projects regardless of visibility; manages keys, members | Show owner-only affordances (delete workspace, member management, all-projects view) |
| `member` | Create/edit/run projects, tasks, pipelines, prompts; approve gates; publish | Default creator. May also hold `canManageKeys` (per-user flag) → can add/rotate API keys |
| `viewer` | **Read-only.** Browse, view; **cannot** create/edit/run | Hide or disable every create/edit/run/delete control; show read views only |

**Email verification gate.** Unverified users can sign in but are limited to **Home + Marketplace** browsing; create/run is blocked server-side. Google sign-ins auto-verify. → Design a gentle "verify to unlock" state, not a hard wall.

**Project sharing** (per-project, on top of role):
- `private` (default) — creator + workspace owners only.
- `shared` / `people` — creator + a named `sharedWith` list (full access).
- `workspace` / `all` — every member of the workspace.

## 1.3 Core domain concepts (in business terms)

- **Workspace** — collaboration + billing-of-keys container. Holds everything. Personal vs team.
- **Project** — a product/brand and its board. Carries **context variables** (`product`, `niche`, `homepage`, brand brief) that fill `{product}` / `{niche}` / `{homepage}` placeholders in step prompts. Has connected **channels** and an optional **brand kit** (logo + accent). Holds **Tasks**.
- **Task** — a kanban card inside a project (a unit of work). Has manual status/priority/assignee and the **pipelines** assigned to it. Runs scope to (task, pipeline).
- **Prompt** — reusable content in the workspace **library**. `draft` (author-only) or `public`. Typed (text/image/audio/video — metadata badge). Owns its **saved results** (curated answers). **Creator-only editable** (author + owner).
- **Pipeline** — a reusable, **linear** chain of **Steps** in the workspace library. Each step binds a **Prompt** to a **provider·model** and a **mode** (`auto` = run immediately, `gate` = pause for approval). Steps may be **prompt** nodes or **action** nodes (research, score, unit-econ, brand, crawl, publish, …). Assigned to projects/tasks and run in their context.
- **Run** — one execution of a pipeline. A **state machine**: `idle → running → awaiting_gate → done | error`. Freezes a snapshot of steps + variables at creation (library edits never corrupt an in-flight run). Steps chain via `{input}` (prior output) and `{step:Name}` (any earlier step). Carries an evidence/sources ledger for research.
- **Product** — a durable, researched opportunity with a full evidence ledger, scores, decision, economics, risk, competition, and a manual lifecycle status.
- **Chat (Conversation)** — the **AI assistant** (bottom-right "AI" FAB), a multi-turn Claude-style workbench for iterating on prompts. Good answers graduate to the library via **Save as prompt**.
- **Marketplace** — a global, read-only CC0 prompt catalog. **Adopt** copies one into your library as a draft.
- **Channels / Publishing** — social accounts (Postiz pool, GoLogin profiles) selected per project; runs' media get published, producing **PublishedPost** receipts.
- **Monitor** — competitor ad tracking (Meta).

**Isolation rule (important for IA):** Chats, Prompts, Pipelines, and Projects are **separate lanes**. A pipeline run never reads a prompt's chat results; a project's run history is fresh per (task, pipeline). Don't design cross-contamination between them.

## 1.4 Key user flows (design the journeys, not just screens)

**A. Compose → assign → run a creative pipeline (the core loop)**
1. Create/open a **Project** (set product/niche/homepage, visibility).
2. Add a **Task** to its board.
3. In the task, **assign a pipeline** from the library (or build a new one inline in the builder).
4. **Run in [project]** → variables auto-fill; confirm.
5. **RunFlow** lights up the vertical flow: `auto` steps run; **`gate` steps pause** → user reviews the result inline and clicks **Approve**; user can re-run a single step, run-all, reset, or stop.
6. At image/video steps, **approve/reject individual assets**.
7. Final gate passes → run `done`; results live in the task's run history; **publish** to channels.

**B. Product research → explainable decision**
1. Create/seed the **research pipeline** (Research → DemandGate → Score → UnitEcon → Evaluate → SaveProduct, gates on DemandGate/Evaluate/SaveProduct).
2. **Run** with a search prompt. The Research step runs a bounded Tavily agent loop; **every claim is grounded in a cited source or dropped** (no fabrication).
3. DemandGate requires ≥3 distinct-source demand signals or pauses for review.
4. Score grades 10 sub-dimensions (0–5 each) → weighted 0–100 + confidence grade A–D.
5. UnitEcon computes CM1 / max-CAC / target-ROAS, records assumptions where data is missing.
6. Evaluate decides (TEST_NOW / RESOLVE_GAPS / LOW_COST_VALIDATION / PARK / REJECT) with **non-compensatory floors** (a critical-factor floor or hard gate can force REJECT even with a high total).
7. SaveProduct (gate) persists the **Product** with its full ledger.
8. **Product detail** shows the whole evidence dashboard; user marks lifecycle status (validating/testing/scaling/…).

**C. Chat → Save as prompt → use in pipeline**
Chat with the AI assistant → **Save as prompt** (creates a library draft, carrying provider·model) → publish → bind it in a pipeline step via the searchable **PromptPicker** (public prompts only).

**D. Marketplace → adopt**
Browse the card gallery → **Copy/Add** adopts a catalog prompt into the library as a draft → edit → use.

**E. Team setup**
Owner creates team workspace → adds **encrypted API keys** → **invites** members (email + role; copyable accept link) → members join and collaborate under sharing rules.

## 1.5 Screens & information architecture

**Shell:** persistent left **sidebar** + a floating bottom-right **"AI" FAB** (opens Chats). Sidebar groups:
- **Home** · **Marketplace**
- **Workspace:** Prompts · Pipelines · Projects · **Products**
- **Built-ins:** Chats (via FAB) · Publish · Connections · Import media · Monitor
- **Settings** (keys, workspace, preferences) · **Members** (team) · **Admin** (super-admin) · Logout

**Surfaces** (purpose in one line):

| Screen | Purpose |
|---|---|
| **Home** | Onboarding checklist + quick-start tiles + recent projects/runs |
| **Projects** | Card gallery of projects (read view; edit via editor) |
| **ProjectDetail** | Task **board** + Tasks/Products toggle sidebar |
| **TaskDetail** | **Run workbench** (RunFlow) + run history |
| **Prompts** | Library card gallery (read); eye → details, edit → editor |
| **PromptEditor** | Full prompt edit (content, media, tags, type, status) on **EditorShell** |
| **Pipelines** | Library card gallery; inline tag edit; open → builder |
| **PipelineBuilder** | Vertical-flow **create+edit** + unified **run** view; step drawer with **PromptPicker** |
| **Marketplace** | prompts.chat-style cards: title · type pill · category pill · code block · tags · Copy/Open-in-chat/View/Add |
| **Chats** | Claude-style multi-turn assistant; per-message Copy/Save/Rate |
| **Products** | Product-pool board (columns per lifecycle status); cards show score + decision |
| **Product detail** | Full **evidence dashboard** (scores, sources, economics, decision, risk, competition, …) |
| **Settings** | Per-provider API-key cards; workspace; theme/language |
| **Members** | Team roster; invite (email + role); role/remove |
| **Connections / Publish / Import / Monitor** | Channel mgmt · multi-channel post composer · media crawler · competitor tracking |
| **Admin** | Super-admin users + requests |

All library pages (Prompts/Pipelines/Projects/Products/Members) are **card galleries** and **pure read views** — editing happens in dedicated editors, never inline on the card.

## 1.6 Business rules that shape UX (do not violate)

1. **Per-step key gating.** A step is runnable only if the workspace holds an `ApiKey` for that step's provider. Missing key → step control **disabled** with a tooltip pointing to Settings.
2. **Gates pause the run.** `gate` steps stop the run at `awaiting_gate`; the user must **Approve** inline. State persists — the user can leave and return.
3. **Run snapshot immutability.** A running step shows the prompt **as snapshotted at run start**; editing the library prompt won't change an in-flight run.
4. **Creator-only prompt edit.** View = any member (if public); edit/delete = author + owner. Drafts never appear in the PromptPicker.
5. **Visibility.** Private by default; owners see all. Reflect the exact mode with a badge.
6. **Evidence-first research.** Every research claim cites a source or is dropped. Surface "no data" honestly — never fabricate a stat. Show numbers **with** sources and confidence labels.
7. **Viewer is read-only.** Hide/disable create/edit/run/delete for viewers.

---

# PART 2 — DATA FIELDS (Business-Analyst view)

> Only the fields that matter for design — the ones that render on screen, drive states/badges/filters, or define relationships. **Full enum value lists are authoritative** (badges/columns/filters must use exactly these). Source of truth: `packages/shared/src/{models,enums,constants}`. Server-only fields (`passwordHash`, `encryptedKey`, `tokenHash`) **never** reach the UI.
>
> Every domain entity carries an audit envelope: `active` (soft-delete), `createdBy`/`updatedBy` (as `{id, name}` UserRef), `createdAt`/`updatedAt`.

## 2.1 Identity & tenancy

**User** — `email`, `name`, `emailVerified` (gates access), `isAdmin?` (derived). Avatar = initials.

**Workspace** — `name`, `type`: `personal | team`.

**Membership** — `role`: `owner | member | viewer`, `canManageKeys` (bool). Surfaced in Members as `MemberView` (email, name, role, canManageKeys).

**Invite** — `email`, `role`, `status`: `pending | accepted | revoked | declined`, `expiresAt`. `MyInvite` powers the notification bell.

**ApiKey** — `provider`, `last4` (display only). One per (workspace, provider).

## 2.2 Library: Prompt, Conversation, Label, Marketplace

**Prompt** — `title`, `content`, `status`: `draft | public`, `type` (`PromptType`): `text | image | audio | video | file`, `tags[]`, `provider?`·`model?` (defaults), `media[]`, `results[]` (SavedResult).
- **SavedResult** (child): `output`, `provider`, `model`, `promptSnapshot`, `rating?`, `note?`, `assetUrl?`, `savedAt`.

**Conversation (Chat)** — `title`, `provider`, `model`, `originPromptId?`, `starred`, `messages[]`.
- **ConversationMessage**: `role`: `user | assistant`, `content`, `media?`, `provider`, `model`, `usage?{tokens,costUsd}`, `error?`.
- `ConversationSummary` (sidebar list): + `messageCount`, `lastMessageAt`.

**Label** — `name`, `color` (hex). Prompts/pipelines/tasks reference labels **by name**; color resolves from here. One per (workspace, lowercased name).

**MarketplacePrompt** (global, not workspace-scoped) — `title`, `description?`, `content`, `type`: `text | structured`, `category?`, `tags[]`, `variables[]`, `contributor?`, `source`.

## 2.3 Projects & tasks

**Project** — `name`, `description`, `variables[]` (`{key,value}` → fill `{key}` placeholders), `status`: `draft | public`, `shared`: `all | people`, `sharedWith[]`, `channels[]`, `brandKit?` (`{logoUrl?, accentColor?}`), `taskCount?` (list view).

**Task** — `name`, `description`, `status` (`TaskStatus`): `new | in_progress | on_hold | complete`, `priority` (`TaskPriority`): `none | urgent | high | medium | low`, `assignee?`, `pipelines[]` (library pipeline ids), `tags[]`, `runs?` rollup (`{total, running, awaitingGate, done}`).

## 2.4 Pipelines & execution

**Pipeline** — `name`, `description`, `tags[]`, `steps[]`, `variables[]` (`{key,label?,default?}`), `origin?` (`{source: ai|manual, goal?, model?}`).

**PipelineStep** — `name`, `promptId` (empty = **"gap"** step, badge it), `provider`, `model`, `mode` (`StepMode`): `auto | gate`, `kind?` (`StepKind`): `prompt | action`, `action?`, `fanOut?`, `condition?`.

**Run** — `status` (`RunStatus`): `idle | running | awaiting_gate | done | error`, `currentStep`, `steps[]`, `variables?` (frozen snapshot), `collections?` (for fan-out), `rating?` (`{value: up|down}`), `pipelineName?`, `projectId?`/`taskId?` (absent = builder **test run**).

**Step (run result)** — `index`, `name?`, `provider?`, `model`, `mode`, `status` (`StepStatus`): `idle | queued | running | waiting | skipped | done | error`, `prompt`, `sentPrompt?` (resolved), `result?`, `assetIds?`, `usage?`, `error?`, `cached?`, `evidence?` (EvidenceClaim[]), `sources?` (SourceRow[]). `skipped` = guard `condition` failed; run continues linearly (no branching).

**Asset** — `type`: `image | video | audio`, `url`, `thumbUrl?`, `approved?` (QA flag), `runId`, `stepIndex`.

**Providers** (`Provider` enum, drives key cards + ProviderIcon + per-step gating): `openai · anthropic · deepseek · google · image · video · crawl · research`.

**MODEL_CATALOG** (per-provider model dropdowns): Anthropic `claude-opus-4-8 / claude-sonnet-4-6 / claude-haiku-4-5-20251001`; OpenAI `gpt-5.5-pro / gpt-5.5`; DeepSeek `deepseek-v3-local / llama-3.3-local / deepseek-reasoner / deepseek-chat`; Image `gpt-image-1 / dall-e-3`; Video `minimax/video-01 / kwaivgi/kling-v1.6-standard / luma/ray`; Google `gemini-2.5-flash-image`; Crawl `fetch`; Research `auto`.

**Fixed StepKey** (legacy 8-step, now seed/reference only): `find · crawl · brief · insight · prompts · images · video · qa`.

**ActionType** (action-node steps): `brand · crawl · publish · unit-econ · evaluate · save-product · score · demand-gate · resolve-inputs · competition · risk-screen · customer-job · review-mining · creative-potential · supply-chain · validation-plan`.

## 2.5 Product research (the explainability dashboard data)

**Product** — `name`, `description`, `source?` (`{platform?, url?}`), `niche?`, `category?`, `images[]`, `price?`, `compareAtPrice?`, `offer?`, `tags[]`, `outcome?`, and:
- `status` (`ProductStatus`): `candidate | validating | testing | scaling | declining | killed` → **board columns**.
- `score?` (0–100), `grade?` (`ConfidenceGrade`): `A | B | C | D`, `decision?` (`Decision`): `TEST_NOW | RESOLVE_GAPS | LOW_COST_VALIDATION | PARK | REJECT` → **decision pill**.
- `subScores?` — 10 dimensions, 0–5 each (`ScoreKey` + weights): `demandIntent` (15) · `trendDurability` (10) · `problemIntensity` (10) · `whitespace` (12) · `unitEconomics` (18) · `creativePotential` (10) · `channelFit` (7) · `supplyQuality` (8) · `riskCompliance` (5) · `expansionValue` (5) → **score breakdown bars**.
- `evidence[]` (**EvidenceClaim**: `statement`, `value?`, `kind`: `verified|calculated|estimate|assumption`, `sourceId`, `quote?`) + `sources[]` (**SourceRow**: `name`, `url`, `accessDate`, `primary`, `alive`) → **evidence + citations**.
- `unitEcon?` (`{cm1, cm1Pct, breakEvenRoas, maxCac, targetRoas}`) + `unitEconInputs?` + `assumptions[]` + `scenarios?` (low/base/high/+10cac/+10landed/doubleReturns) → **economics table + sensitivity grid**.
- `hardGates?` (`unresolvedSafety, materialIpRisk, negativeUnitEcon, cpaExceedsMaxCac, singleSourceDemand, misleadingClaimsRequired`) + `riskFlags?` + `riskNotes[]` → **risk section** (dealbreakers that force REJECT).
- `competition?` (`competitors[]` + `marketType`: `healthy|dominated|commodity|emerging|underserved`).
- Depth blocks: `customerJob?` · `reviewMining?` · `creativeConcepts[]` · `supplyChain?` · `validationPlan?`.

**Competitor monitor** — **Competitor** (`brand`, `niche`, `status`: `candidate|watching|archived`), **MonitorAd** (`creativeUrl?`, `copy?`, `status`: `active|stopped`, `firstSeen/lastSeen`, `daysRunning`), platform: `meta`.

## 2.6 Publishing & channels

**Channel** — `type`: `postiz | gologin`, `platform` (tiktok/instagram/youtube/facebook/…), `displayName`, `postCount?`, `lastPostAt?`.
**PublishedPost** — `caption`, `mediaUrls[]`, `channelIds[]`, `targets[]` (per-channel `Receipt`: `status: ok|failed`, `url?`), `status`: `ok | partial | failed`.

## 2.7 Admin / support

**UserRequest** — `type`: `provider | bug | team-upgrade`, `subject`, `status`: `open | resolved | declined`, `voteCount`.

---

# PART 3 — DESIGN SYSTEM (UI/UX-Designer view)

> The live system is **Notion** (`docs/notion-design.md`): warm-neutral paper canvas, one confident **blue** accent, system font, flat surfaces with hairlines (not heavy shadows), full dark mode. **Style only via the CSS tokens in `apps/web/src/index.css` — never hardcode a value.** Reuse the shared primitives — don't invent new controls.

## 3.1 Design language

- **Restraint + one accent.** All structural personality comes from a single blue (`#0075de`), reserved for CTAs, focus, active states. No multi-color structural palette. (Section hub tiles get their own accent each — see token list — but that's the exception.)
- **Paper-calm canvas.** Warm off-white surfaces (`#f6f5f4`), document-like and quiet.
- **Bold, tight headings; calm body.** Headings 700, tight tracking; body 400, line-height 1.5.
- **System font, flat.** No webfont; elevation via hairlines + barely-there layered shadows.
- **Dark mode is first-class.** Every surface inverts via `[data-theme='dark']`; design and check both.

## 3.2 Color tokens (light → dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--app-bg` | `#ffffff` | `#191919` | App background |
| `--surface-1` | `#f6f5f4` | `#202020` | Warm paper — sidebar, nested surfaces |
| `--surface-2` | `#efedea` | `#2c2c2c` | Hover surface |
| `--surface-3` | `#e6e3df` | `#373737` | Active/pressed surface |
| `--card` / `--field` | `#ffffff` | `#252525` / `#1c1c1c` | Cards, modals, inputs |
| `--hairline` | `rgba(55,53,47,.09)` | `rgba(255,255,255,.094)` | 1px borders/dividers |
| `--hairline-strong` | `rgba(55,53,47,.16)` | — | Hover/focus borders |
| `--ink` | `#31302e` | `#ededeb` | Primary text (warm near-black) |
| `--ink-muted` | `#615d59` | — | Secondary text |
| `--ink-tertiary` | `#75726b` | — | Tertiary / group labels |
| `--placeholder` | `#918d86` | — | Placeholder text |
| `--primary` | `#0075de` | `#2383e2` | **Brand / CTA / active** |
| `--primary-hover` | `#2383e2` | `#3b91e8` | CTA hover |
| `--primary-pressed` | `#005bab` | `#0075de` | CTA pressed |
| `--primary-tint` | `rgba(0,117,222,.12)` | `rgba(35,131,226,.22)` | Tint backgrounds, badges |
| `--success` | `#0f9d58` | `#2eb872` | Positive |
| `--warning` | `#dd5b00` | `#e9a23b` | Warning |
| `--danger` | `#e03e3e` | `#ff6369` | Destructive/error |
| `--on-accent` | `#ffffff` | — | Text on filled accent |
| `--code-bg` / `--code-ink` | `#1d1f23` / `#e6e6e6` | (same) | Code blocks (theme-independent) |
| `--scrim` | `rgba(0,0,0,.35)` | (darker) | Modal backdrop |

**Section hub-tile accents** (Home/nav tiles only): `--accent-chats #f59e0b` · `--accent-prompts #14b8a6` · `--accent-pipelines #0075de` · `--accent-projects #0ea5e9` · `--accent-keys #7c5cff` · `--accent-members #ec4899` · `--accent-marketplace #10b981` · `--accent-publish #f43f5e`.

**Map data states to tokens:** run/step `running` → `--primary`; `awaiting_gate`/`warning` → `--warning`; `done`/`success` → `--success`; `error` → `--danger`; `skipped`/`idle` → `--ink-tertiary`. Decision pills: TEST_NOW → `--success`; RESOLVE_GAPS/LOW_COST_VALIDATION → `--warning`; PARK → `--ink-muted`; REJECT → `--danger`.

## 3.3 Radius, shadow, type, spacing

**Radius:** `--radius-sm 6px` (nav/menu) · `--radius-md 8px` (controls) · `--radius-lg 12px` (cards/panels) · `--radius-button 6px` · `--radius-control 6px`.

**Shadow (flat, layered, soft):** `--shadow-sm` (cards at rest) · `--shadow-md` (card hover) · `--shadow-lg` (modals) · `--shadow-button` / `--shadow-button-strong` · `--shadow-popover` (dropdowns). Dark mode deepens the alphas. **No hard drop-shadows.**

**Typography** — font `-apple-system, BlinkMacSystemFont, ui-sans-serif, 'Segoe UI', …`. Scale tokens: `--text-micro 11` · `--text-mini 12` · `--text-small 13` · `--text-normal 16` (body, lh 1.5, tracking -0.006em) · `--text-large 18` · `--text-title3 20/600` · `--text-issue 22/700` · `--text-title2 24` · `--text-title1 36`. Global `h1–h4`: weight 700, line-height 1.1, tracking -0.02em.

**Spacing** — 8px base; common steps 4/6/8/10/12/14/16/20/24/28/32/48px. Card grid gap 14px; page padding 28px (16px on mobile).

## 3.4 Shared components (reuse — don't reinvent)

| Component | Purpose | Notes / variants |
|---|---|---|
| **MenuPicker** | **Mandatory** single-select dropdown | Use for **every** dropdown; **never** native `<select>`. Icon + label options |
| **LabelPicker** | Multi-select tags with inline create + color | For prompt/pipeline/task tags |
| **EditorShell** | Full-page editor layout | Title in header, `crumb` (mobile), `actions`, `wide` for builders; hides the app topbar + AI FAB |
| **IconButton** | Token-driven icon button | `variant`: default/primary/danger/success · `size`: sm/md/lg · `label` required (a11y) |
| **Modal** + **ConfirmDialog** | Centered dialog / confirm | Max-width ~380px (fits 390px viewport); `danger` = red confirm; X close top-right |
| **EmptyState** | List empty states | `icon`, `title`, `body`, `cta{label,onClick}` |
| **PromptCodeBlock** | Read-only prompt block + Copy | Dark code surface; optional Run/Open-in-chat |
| **ProviderIcon** | Branded provider badge | Anthropic/OpenAI/DeepSeek/Image/Video/Google |
| **Avatar** | Initials circle | size + color |
| **RunFlow / FlowPager** | Vertical run flow (desktop) / one-step pager (mobile) | Live per-step status, inline gate Approve, expandable results |
| **PromptPicker** | Searchable picker (public prompts) | In the step drawer |

**Card system:** `.lib-grid` (`grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap:14px`) + `.lib-card` (padding 16, `--card` bg, `--hairline` border, `--radius-lg`, hover lifts to `--shadow-md`).

**Buttons:** `.btn-primary` (filled blue) · `.btn-ghost` (hairline + soft fill) · `.btn-danger` (red). Sizes `.btn-lg 40 / .btn-sm 28 / .btn-xs 24`. `.btn-inline` for auto-width.

## 3.5 Canonical affordances (same action, same icon, everywhere)

| Action | Control | Icon |
|---|---|---|
| View / preview | `IconButton` | **Eye** |
| Open / go to detail | `IconButton` | entity icon |
| Delete / remove | `IconButton variant="danger"` | **X** |
| Close modal/drawer | `IconButton` | **X** (top-right) |
| Add / new | `IconButton variant="primary"` or `.btn-primary` | **Plus** |
| Confirm / save / run | `.btn-primary` (labeled) | — |
| Cancel | `.btn-ghost` "Cancel" | — |

Irreversible actions in a dialog use a **labeled** `.btn-danger` ("Delete"), never a bare icon. Icons live in `apps/web/src/layout/icons.tsx`.

## 3.6 App shell & layout

- **Sidebar** 248px (collapses to 64px icon rail; drawer ≤600px), `--surface-1` bg, brand row + nav groups (`.nav-item`, active = `--surface-2` + 3px `--primary` left bar) + workspace switcher + user footer.
- **Topbar** 52px, **frosted** (`backdrop-filter: blur(14px)`, translucent `--card`), sticky, breadcrumb + title + actions.
- **Content** max-width 1240px centered; padding 28px top/sides, 48px bottom; only the main column scrolls.
- **AI FAB** 48px circular `--primary`, fixed bottom-right 24px (16px mobile), `--shadow-lg`; hidden on editor/builder pages.
- **Modals** `--scrim` backdrop (z 100), card surface, `--shadow-lg`, X top-right.

## 3.7 Responsive rules

- Breakpoints: **≤600px** mobile (single column, drawer sidebar, hamburger, full-width CTAs), **600–820px** tablet (2-up grids), **≥821px** desktop.
- **Verify ~390px**, not just desktop. Use `minmax(0,1fr)` patterns — **never `repeat(N,1fr)`** (it overflows phones). Watch `order:-1` pushing forms off-screen.
- iOS: form controls 16px font to avoid zoom-on-focus.
- Editors go mobile-first full-viewport (`100dvh`) via EditorShell; builders use **FlowPager** (one step at a time).

## 3.8 Do / Don't (quick gate before shipping a screen)

**Do:** use tokens; reuse MenuPicker/IconButton/EmptyState/Modal/EditorShell; one blue accent; hairlines over shadows; system font; bold-tight headings; design dark + mobile; map enum states to the status tokens above; show research numbers **with** sources + confidence.

**Don't:** hardcode hex; use native `<select>`; invent a new status not in an enum; roll bespoke dialogs; add a second structural accent color; fabricate a stat (say "no data"); show create/edit/run controls to viewers; let a `repeat(N,1fr)` grid overflow mobile.

---

# PART 4 — PROMPT FOR THE DESIGN AGENT

Paste this, filling the brackets. It points the agent at this brief and enforces the rules.

```
You are an expert product designer designing a screen for Lyra — a multi-user web app
for e-commerce/dropshipping teams to (1) find & validate winning products via an
explainable, evidence-cited research pipeline, and (2) produce on-brand AI images/UGC
video through composable pipelines with human approval gates.

READ FIRST (source of truth): docs/lyra-design-brief.md.
- Part 1 = the business/UX (users, roles, flows, rules). Get the UX right by obeying it.
- Part 2 = the data fields + exact enum values that drive badges/columns/filters.
- Part 3 = the LIVE design system (Notion: warm-neutral + blue #0075de, system font,
  flat with hairlines, full dark mode). Ignore any "Linear/orange" notes elsewhere — superseded.

DESIGN THIS: [screen/feature, e.g. "the Product detail evidence dashboard" or
"the TaskDetail RunFlow with a gate awaiting approval"].
For users in role: [owner | member | viewer]. State: [empty | typical | error | loading | gate-paused].
Viewport(s): [desktop 1240px and mobile 390px].

NON-NEGOTIABLE RULES:
- Style ONLY with the Part 3 tokens; never hardcode a color/size. One blue accent.
- Reuse the shared components in Part 3.4 (MenuPicker for ALL dropdowns — never native
  <select>; IconButton with canonical icons: view=Eye, delete/close=X, add=Plus; .lib-grid/
  .lib-card; .btn-primary/.btn-ghost/.btn-danger; Modal/ConfirmDialog; EmptyState; EditorShell;
  RunFlow/FlowPager; PromptCodeBlock; ProviderIcon). Don't invent new controls.
- Use only enum values from Part 2 for any status/badge/pill/column/filter. Map states to the
  status tokens in Part 3.2 (running→primary, awaiting_gate→warning, done→success, error→danger,
  idle/skipped→ink-tertiary; decision pills per the table).
- Honor the business rules (Part 1.6): gates pause runs with an inline Approve; steps with no
  provider key are disabled with a "add key in Settings" tooltip; viewers see read-only;
  research must show numbers WITH cited sources + confidence (A–D) and say "no data" rather than fabricate.
- Responsive per Part 3.7: minmax(0,1fr) not repeat(N,1fr); verify 390px; design dark mode too.

DELIVER: [Figma frames | annotated mockup | component spec], for both light and dark,
desktop and mobile, with each state above. Annotate which token and which shared component
each element uses, and call out the affordances (eye/X/plus) explicitly.
```

**Example fill (Product detail):** *"DESIGN THIS: the Product detail evidence dashboard — header (name, source link, image carousel, status MenuPicker, decision pill), score breakdown (10 sub-score bars), evidence list with source citations + confidence kind, economics table + sensitivity grid, a Risk section (hard gates as dealbreaker chips), and competition. For an owner, typical state, desktop 1240px + mobile 390px, light + dark."*
