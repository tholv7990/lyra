# Multi-platform account/connection model (derived grouping) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the flat `Channel` list as **Connections → Accounts** (one GoLogin browser profile owns multiple platform accounts; Postiz is one pool) across the Connections, Publish, and Project-editor pickers — as a pure web-layer view, with no backend/migration.

**Architecture:** A single pure helper `groupChannels()` groups the existing `Channel[]` by connection (GoLogin → by `profileId`; Postiz → one pool). The three consumers render that grouping. "Add account" reuses the existing `POST /channels` with the connection's `profileId`. No schema, no `@lyra/shared`, no API/DTO change.

**Tech Stack:** React + Vite (`apps/web`), existing Notion CSS tokens, Vitest (`renderToStaticMarkup`/pure-fn tests, node env), i18next.

## Global Constraints (every task — verbatim from spec)
- **NO backend change**: no `apps/api`, no `@lyra/shared`, no DTO/Mongo/schema edits. The `Connection` view type lives **only** in `apps/web/src/lib/connections.ts`.
- **Derived, nothing persisted**: `PublishedPost.channelIds` and `Project.channels: string[]` shapes are untouched; pickers still emit/store channel ids.
- **Token-only styling** via existing `:root` (Notion design system); reuse shared web primitives; **no hardcoded colors**. New CSS uses existing tokens only.
- **Responsive**: group headers + nested rows must not overflow at ~390px — use `minmax(0,1fr)`/`min-width:0` (per the 2026-06-22 mobile lesson). Verify at 390px in the final pass.
- **i18n en + vi** for all new copy (`apps/web/src/i18n/locales/{en,vi}/connectors.ts`; projects picker reuses `connectors.*` keys).
- **Web tests** via Vitest pure-fn / `renderToStaticMarkup` only — **no RTL/jsdom**.
- **Per-task LOCAL commits**; explicit `git add <paths>` — **never `-A`** (a Codex agent shares the main tree). **Deploy/push HELD for the user.**
- Existing pure-fn tests must stay green: `apps/web/src/pages/PublishComposer.test.ts` (`togglePick`).

---

## Task 1: `groupChannels` helper + tests

**Files:**
- Create: `apps/web/src/lib/connections.ts`
- Test: `apps/web/src/lib/connections.test.ts`

**Interfaces:**
- Consumes: `ChannelType`, `Channel` from `@lyra/shared` (`Channel = { id, type, platform, displayName, profileId?, proxy?, postCount?, lastPostAt?, createdAt? }`).
- Produces:
  - `interface Connection { key: string; connector: ChannelType; profileId?: string; proxy?: string; accounts: Channel[]; postCount: number; lastPostAt?: string }`
  - `function connectionKey(c: Channel): string`
  - `function groupChannels(channels: Channel[]): Connection[]`
  - `function shortProfileId(id?: string): string`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/connections.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ChannelType, type Channel } from '@lyra/shared';
import { groupChannels, connectionKey, shortProfileId } from './connections';

const mk = (over: Partial<Channel>): Channel =>
  ({ id: 'i', type: ChannelType.GoLogin, platform: 'tiktok', displayName: 'n', ...over } as Channel);

describe('groupChannels', () => {
  it('groups GoLogin channels sharing a profileId into one connection', () => {
    const conns = groupChannels([
      mk({ id: 'a', profileId: 'p1', platform: 'tiktok', postCount: 2, lastPostAt: '2026-06-01' }),
      mk({ id: 'b', profileId: 'p1', platform: 'facebook', postCount: 3, lastPostAt: '2026-06-10' }),
    ]);
    expect(conns).toHaveLength(1);
    expect(conns[0].connector).toBe(ChannelType.GoLogin);
    expect(conns[0].profileId).toBe('p1');
    expect(conns[0].accounts.map((c) => c.id)).toEqual(['a', 'b']);
    expect(conns[0].postCount).toBe(5);
    expect(conns[0].lastPostAt).toBe('2026-06-10'); // max
  });

  it('separates GoLogin channels with different profileIds', () => {
    const conns = groupChannels([
      mk({ id: 'a', profileId: 'p1' }),
      mk({ id: 'b', profileId: 'p2' }),
    ]);
    expect(conns).toHaveLength(2);
    expect(conns.map((c) => c.profileId)).toEqual(['p1', 'p2']);
  });

  it('groups all Postiz channels into a single pool, profileId undefined', () => {
    const conns = groupChannels([
      mk({ id: 'a', type: ChannelType.Postiz, profileId: undefined }),
      mk({ id: 'b', type: ChannelType.Postiz, profileId: undefined }),
    ]);
    expect(conns).toHaveLength(1);
    expect(conns[0].key).toBe('postiz');
    expect(conns[0].connector).toBe(ChannelType.Postiz);
    expect(conns[0].profileId).toBeUndefined();
    expect(conns[0].accounts).toHaveLength(2);
  });

  it('preserves first-appearance order across a mix and picks up proxy', () => {
    const conns = groupChannels([
      mk({ id: 'a', type: ChannelType.Postiz, profileId: undefined }),
      mk({ id: 'b', profileId: 'p1', proxy: 'us-1' }),
    ]);
    expect(conns.map((c) => c.key)).toEqual(['postiz', 'gologin:p1']);
    expect(conns[1].proxy).toBe('us-1');
  });

  it('returns [] for no channels', () => {
    expect(groupChannels([])).toEqual([]);
  });
});

describe('connectionKey / shortProfileId', () => {
  it('keys GoLogin by profileId and Postiz as the pool', () => {
    expect(connectionKey(mk({ profileId: 'p9' }))).toBe('gologin:p9');
    expect(connectionKey(mk({ type: ChannelType.Postiz, profileId: undefined }))).toBe('postiz');
  });
  it('shortens long profile ids and passes short/empty through', () => {
    expect(shortProfileId('6a33b9c0d1e2')).toBe('6a33b9…');
    expect(shortProfileId('abc')).toBe('abc');
    expect(shortProfileId(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/web test -- connections`
Expected: FAIL — `Cannot find module './connections'` / exports undefined.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/connections.ts`:
```ts
import { ChannelType, type Channel } from '@lyra/shared';

// A derived grouping of channels into a "connection" — a GoLogin browser profile
// (owns multiple platform accounts) or the single Postiz pool. NOTHING is persisted;
// this is a pure view over the flat Channel list.
// See docs/superpowers/specs/2026-06-22-multi-platform-accounts-design.md
export interface Connection {
  key: string; // group key: `gologin:${profileId}` | 'postiz'
  connector: ChannelType;
  profileId?: string; // GoLogin only
  proxy?: string; // GoLogin only — first account that carries one
  accounts: Channel[]; // grouped channels, in input order
  postCount: number; // sum over accounts
  lastPostAt?: string; // max over accounts (ISO strings sort lexically)
}

export function connectionKey(c: Channel): string {
  return c.type === ChannelType.GoLogin ? `gologin:${c.profileId ?? ''}` : 'postiz';
}

export function groupChannels(channels: Channel[]): Connection[] {
  const order: string[] = [];
  const map = new Map<string, Connection>();
  for (const c of channels) {
    const key = connectionKey(c);
    let conn = map.get(key);
    if (!conn) {
      conn = {
        key,
        connector: c.type,
        profileId: c.type === ChannelType.GoLogin ? c.profileId : undefined,
        accounts: [],
        postCount: 0,
      };
      map.set(key, conn);
      order.push(key);
    }
    conn.accounts.push(c);
    conn.postCount += c.postCount ?? 0;
    if (!conn.proxy && c.proxy) conn.proxy = c.proxy;
    if (c.lastPostAt && (!conn.lastPostAt || c.lastPostAt > conn.lastPostAt)) {
      conn.lastPostAt = c.lastPostAt;
    }
  }
  return order.map((k) => map.get(k)!);
}

// Compact a long GoLogin profile id for display (header chip). i18n-free on purpose.
export function shortProfileId(id?: string): string {
  if (!id) return '';
  return id.length <= 8 ? id : `${id.slice(0, 6)}…`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lyra/web test -- connections`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/connections.ts apps/web/src/lib/connections.test.ts
git commit -m "feat(web): groupChannels helper — derive connections from flat channels"
```

---

## Task 2: Connections page — connection cards + Add account / New connection

**Files:**
- Modify: `apps/web/src/pages/Connections.tsx`
- Modify: `apps/web/src/pages/connectors.css` (only if a new group rule is needed; reuse `cxv2-*` classes)
- Modify: `apps/web/src/i18n/locales/en/connectors.ts`, `apps/web/src/i18n/locales/vi/connectors.ts`

**Interfaces:**
- Consumes: `groupChannels`, `shortProfileId`, `type Connection` from `../lib/connections` (Task 1); existing `channelsApi.create/remove/list`, `PROVIDER_META`, `ProviderBlock` markup.
- Produces: nothing for later tasks.

**Context:** Today [Connections.tsx](apps/web/src/pages/Connections.tsx) builds `byType` (group by `ChannelType`) → exactly two `ProviderBlock`s (GoLogin, Postiz). Each block lists its channels and (GoLogin) opens one add-channel modal. Rework so **GoLogin renders one card per `profileId`** (a connection) and **Postiz renders one pool card**; the add modal gains a "locked profileId" mode for "+ Add account".

- [ ] **Step 1: Add i18n keys (en + vi)**

Append to `apps/web/src/i18n/locales/en/connectors.ts` (before the closing `} as const;`):
```ts
  // Connections (multi-account)
  browserProfile: 'Browser profile',
  postizPool: 'Postiz pool',
  addAccount: 'Add account',
  addAccountTitle: 'Add an account',
  newConnection: 'New connection',
  accountsSuffix: 'accounts',
  proxyLabel: 'Proxy',
```
Append the same keys to `apps/web/src/i18n/locales/vi/connectors.ts` with vi values:
```ts
  browserProfile: 'Hồ sơ trình duyệt',
  postizPool: 'Nhóm kênh Postiz',
  addAccount: 'Thêm tài khoản',
  addAccountTitle: 'Thêm một tài khoản',
  newConnection: 'Kết nối mới',
  accountsSuffix: 'tài khoản',
  proxyLabel: 'Proxy',
```

- [ ] **Step 2: Re-shape the render to per-connection cards**

In `Connections.tsx`:
1. Replace the `byType` grouping (the `for (const c of channels)` block, ~308-312) with `const connections = groupChannels(channels);`.
2. Stat strip: set the **Connections** stat value to `connections.length` (distinct connections), keep **Accounts** = `totalChannels`, **Platforms** = `distinctPlatforms` (`new Set(channels.map(c => c.platform)).size`).
3. Replace the two-`ProviderBlock` loop (~355-367) with rendering one card per `Connection`. Generalize `ProviderBlock` into a connection-driven card (rename to `ConnectionBlock`, props `{ conn: Connection; busy; onAddAccount: (profileId: string) => void; onRemove; onConnect }`):
   - Header icon: `PROVIDER_META[conn.connector].icon` / colors.
   - Header title: GoLogin → `t('connectors.browserProfile')` + a chip showing `shortProfileId(conn.profileId)` (+ proxy via `t('connectors.proxyLabel')` when `conn.proxy`); Postiz → `t('connectors.postizPool')`.
   - Status pill: shown when `conn.accounts.length > 0` (unchanged).
   - Desc line: `{conn.accounts.length} {t('connectors.accountsSuffix')}`.
   - Add button: GoLogin → label `t('connectors.addAccount')`, `onClick={() => onAddAccount(conn.profileId!)}`; Postiz → `t('connectors.manageInPostiz')`, `onClick={onConnect}`.
   - Account rows: `conn.accounts.map(...)` — reuse the existing `cxv2-channel-row` markup (avatar, name, `PlatformChip`, GoLogin trash / Postiz spacer).
4. Add a top-level **"+ New connection"** button (existing `openAdd` with empty form) in the providers section — e.g., a header button above `.cxv2-providers` or a trailing ghost card. Use `t('connectors.newConnection')`.
5. When there are **no GoLogin connections at all**, still offer "+ New connection" (so an empty workspace can create the first profile). Postiz pool card renders only when `connections` contains a postiz group (i.e. Postiz returned channels) — if absent, omit it (do not fabricate an empty Postiz card).

- [ ] **Step 3: Wire the "locked profileId" add-account mode**

In `Connections.tsx`:
1. Add state: `const [lockedProfile, setLockedProfile] = useState<string | null>(null);`
2. `const openAdd = () => { setForm(emptyForm); setLockedProfile(null); setError(null); setAddOpen(true); };` (new connection)
3. `const openAddAccount = (profileId: string) => { setForm({ ...emptyForm, profileId }); setLockedProfile(profileId); setError(null); setAddOpen(true); };`
4. In the modal: title = `lockedProfile ? t('connectors.addAccountTitle') : t('connectors.addChannelTitle')`. When `lockedProfile` is set, render the GoLogin profile id field **read-only** (`readOnly` + `disabled` styling) so the account attaches to that profile; otherwise the editable field as today. `canAdd` stays `displayName && profileId` (profileId is prefilled when locked).
5. `addChannel` is unchanged (it already posts `form.profileId`). After success, `setLockedProfile(null)`.

- [ ] **Step 4: Type-check + tests + lint**

Run: `pnpm --filter @lyra/web run type-check && pnpm --filter @lyra/web test -- connections && pnpm --filter @lyra/web run lint`
Expected: type-check clean, Task-1 tests green, lint 0 (no new warnings). (No new unit test here — this is a presentational re-shape over the Task-1 helper; correctness of grouping is covered by Task 1, layout by the final visual pass.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Connections.tsx apps/web/src/pages/connectors.css apps/web/src/i18n/locales/en/connectors.ts apps/web/src/i18n/locales/vi/connectors.ts
git commit -m "feat(web): Connections — per-profile connection cards + add-account flow"
```

---

## Task 3: Publish "Post to" — grouped multiselect

**Files:**
- Modify: `apps/web/src/pages/PublishComposer.tsx`
- Modify: `apps/web/src/pages/publish.css` (add `.pub-channel-group*` rules — tokens only)

**Interfaces:**
- Consumes: `groupChannels`, `shortProfileId` from `../lib/connections`; existing `togglePick`, `picked`, `channels`, `platformLabel`, `color`, `glyph`.
- Produces: nothing.

**Context:** The selector at [PublishComposer.tsx:187-201](apps/web/src/pages/PublishComposer.tsx#L187) maps `channels` flat into `.pub-channel` buttons. Wrap them under per-connection group headers; **the `picked` ids and `togglePick` are unchanged**, so the publish payload (`channelIds`) is identical.

- [ ] **Step 1: Group the channel buttons under connection headers**

Replace the flat `channels.map(...)` inside `.pub-channels` with:
```tsx
<div className="pub-channels">
  {groupChannels(channels).map((conn) => (
    <div className="pub-channel-group" key={conn.key}>
      <div className="pub-channel-group-head">
        {conn.connector === ChannelType.Postiz
          ? t('connectors.postizPool')
          : `${t('connectors.browserProfile')} · ${shortProfileId(conn.profileId)}`}
      </div>
      {conn.accounts.map((c) => {
        const on = picked.includes(c.id);
        return (
          <button key={c.id} type="button" className={`pub-channel${on ? ' on' : ''}`} onClick={() => setPicked((p) => togglePick(p, c.id))}>
            <span className="pub-ico" style={{ background: color(c.platform) }}>{glyph(c.platform)}</span>
            <span className="pub-channel-id">
              <span className="pub-channel-name">{c.displayName}</span>
              <span className="pub-channel-handle">{platformLabel(c.platform)}</span>
            </span>
            <span className="pub-channel-check">{on && <CheckIcon width={11} height={11} />}</span>
          </button>
        );
      })}
    </div>
  ))}
</div>
```
Add `ChannelType` to the `@lyra/shared` import if not already present. Leave the preview tabs (~314) flat — out of scope.

- [ ] **Step 2: Add group-header CSS (tokens only)**

Append to `apps/web/src/pages/publish.css`:
```css
.pub-channel-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pub-channel-group + .pub-channel-group { margin-top: 10px; }
.pub-channel-group-head {
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
  color: var(--ink-3); padding: 2px 2px 0;
}
```
(Use the nearest existing muted-text token if `--ink-3` is absent — confirm against `:root` in `apps/web/src/index.css`; do not invent a token.)

- [ ] **Step 3: Type-check + existing tests + lint**

Run: `pnpm --filter @lyra/web run type-check && pnpm --filter @lyra/web test -- PublishComposer && pnpm --filter @lyra/web run lint`
Expected: type-check clean, `togglePick` tests still green, lint 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/PublishComposer.tsx apps/web/src/pages/publish.css
git commit -m "feat(web): Publish — group Post-to channels under connections"
```

---

## Task 4: Project editor — grouped channel picker

**Files:**
- Modify: `apps/web/src/pages/ProjectEditor.tsx`
- Modify: the project-editor CSS file it imports (add `.pe-channel-group*` rules — confirm the filename from the import at the top of `ProjectEditor.tsx`; likely `projects.css`)

**Interfaces:**
- Consumes: `groupChannels`, `shortProfileId` from `../lib/connections`; existing `toggleChannel`, `form.channels`, `pool`.
- Produces: nothing.

**Context:** The picker at [ProjectEditor.tsx:317](apps/web/src/pages/ProjectEditor.tsx#L317) maps the `pool` flat with `toggleChannel(c.id)`. Wrap under connection group headers; **`form.channels` (string[]) is unchanged**, so the saved `Project.channels` shape is identical. (`ProjectDetail.tsx` shows selected channels as flat chips — left as-is; grouping a small selected subset adds no value.)

- [ ] **Step 1: Group the picker buttons under connection headers**

Wrap the existing `pool.map(...)` channel buttons (the block starting ~317) so it iterates `groupChannels(pool)` → a group header (`t('connectors.browserProfile') · shortProfileId` / `t('connectors.postizPool')`) followed by `conn.accounts.map(...)` rendering the **existing** button markup unchanged (keep `selected = form.channels.includes(c.id)` and `onClick={() => toggleChannel(c.id)}`). Add `ChannelType` + the `connections` imports.

- [ ] **Step 2: Add group-header CSS (tokens only)**

Append to the editor's CSS file:
```css
.pe-channel-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pe-channel-group + .pe-channel-group { margin-top: 10px; }
.pe-channel-group-head {
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
  color: var(--ink-3); padding: 2px 2px 0;
}
```
(Match the existing picker container's class names; reuse the nearest muted token if `--ink-3` is absent.)

- [ ] **Step 3: Type-check + lint**

Run: `pnpm --filter @lyra/web run type-check && pnpm --filter @lyra/web run lint`
Expected: clean, lint 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ProjectEditor.tsx apps/web/src/pages/projects.css
git commit -m "feat(web): Project editor — group channel picker under connections"
```

---

## Task 5: Gate + visual pass (deploy held)

**Files:** none (verification only).

- [ ] **Step 1: Full web gate**

Run: `pnpm --filter @lyra/web run type-check && pnpm --filter @lyra/web test && pnpm --filter @lyra/web build && pnpm --filter @lyra/web run lint`
Expected: all green, lint 0.

- [ ] **Step 2: Visual Playwright pass — desktop + 390px**

On the dev web (`:5173`, or point it at the feature branch), log in (`tholv.7990@gmail.com` / `Putiin15042024@@`) and check **at desktop AND 390px** (mobile lesson — no horizontal overflow, headers/rows shrink):
- **Connections**: GoLogin renders one card per profile with its accounts nested; "+ Add account" opens the modal with the profile id locked; "+ New connection" opens an empty modal; Postiz pool card lists its channels; stat strip "Connections" counts distinct connections.
- **Publish**: "Post to" shows accounts grouped under connection headers; selecting still publishes (payload `channelIds` unchanged).
- **Project editor**: channel picker shows the same grouped headers; saving keeps the project's selected channels.
Fix any overflow/token gaps found.

- [ ] **Step 3: Deploy — HELD**

**Do not push.** When the user asks: ff-merge the feature branch → `codex-dev`, then `git push origin codex-dev:dev`. Web HMRs (no dist rebuild needed for a web-only change).

---

## Self-Review
- **Spec coverage:** §2 model → Task 1 (`groupChannels`/`Connection`); §3 add-account/new-connection → Task 2 (locked profileId, reuse `POST channels`); §4 consumers → Connections (T2), Publish (T3), Project editor (T4); §5 non-goals respected (no backend/migration; `channelIds`/`Project.channels` shapes untouched; ProjectDetail chips left flat; no health probe); §6 constraints in Global Constraints. ✓
- **Placeholder scan:** every code step has complete code; CSS token caveat names the check (confirm against `:root`), not a TODO. ✓
- **Type consistency:** `Connection`/`groupChannels`/`connectionKey`/`shortProfileId` defined in Task 1 and consumed verbatim in T2-T4; `togglePick`/`toggleChannel`/`form.channels`/`picked` unchanged. ✓
- **Note:** Task 2 generalizes `ProviderBlock`→`ConnectionBlock` (props change) — a contained rename within one file; reviewer should confirm no other importer (it is page-local).
