# Lyra v3 — the grounded research → on-brand creative loop (re-architecture + business)

> Synthesis of the June 22 repositioning discussion. Supersedes the Shopify-era framing in the two
> companion docs ([data-model map](2026-06-22-product-research-tracking-model-map.md),
> [competitive landscape](2026-06-22-competitive-landscape-research.md)). Read those for the verified
> current data model and the market evidence; this doc defines what Lyra becomes.
>
> **Revised 2026-06-23:** §1C reworked into a **4-phase user view** + a **trimmed engine recipe**
> (two CODE/demand merges) with an explicit **v1/v2 split**. The internal step count is an engine
> concern; the user sees four phases, one input form, and one decision gate — never "17 steps."

## 0. What changed (the locked scope)

Decisions reached in discussion, now treated as fixed:

- **No Shopify API.** Lyra does not provision, populate, or read a Shopify store. Store output is a
  *content kit* the user pastes in, not an API push. → drops conversion tracking, the Listing/conversion
  join, and all store-provisioning complexity.
- **No paid-ad running.** No Meta/TikTok Ads spend, no ROAS targets-vs-actuals. → drops the ads/campaign
  and stat-snapshot subsystem.
- **Lyra is decision-support, not an oracle.** It *gathers* and *analyzes* evidence and *saves* it; the
  human picks the winner. "Lyra cannot by itself find the winning product" — correct and load-bearing.
- **Track known competitors only** (no discovery of new ones). Trims the monitor.
- **The winner-signal is grounded evidence, not a metric:** tracked-competitor ad longevity + web research +
  downloaded competitor creative + unit-economics. Surfaced for human judgment.
- **Differentiation is brand-consistency + grounded honesty**, since the conversion-truth wedge is gone.

This pulls Lyra *back* to what it already is architecturally — a self-contained, BYO-key generation +
research engine — and away from the external-commerce platform it was drifting toward.

---

## 1. The product-research pipeline (decomposed from the production prompt)

This section is the implementation spec. It is the team's existing ChatGPT deep-research prompt
(`docs/new idea/` / the analyst prompt) **decomposed** into Lyra's typed steps, with the deterministic
parts (arithmetic, scoring aggregation, gate logic, citation resolution) **moved out of the LLM into code**.

The governing discipline — **don't paste the whole prompt into one step.** If you do, you've rebuilt
ChatGPT with extra latency. Each step has exactly one job, writes to a shared evidence ledger, and is one of
four kinds:

- **PROMPT** — grounded LLM extraction; reads fetched data, emits confidence-tagged claims. Never invents.
- **ACTION** — side-effecting tool call (search, fetch, download, persist). No judgment.
- **CODE** — deterministic pure function (math, scoring, grading, gating). No LLM.
- **GATE** — human checkpoint; pauses the run.

The non-negotiable rule survives from the prompt's source rules: **every "find" step stands on fetched
data, never the model's memory.** A PROMPT step may only assert what an ACTION step fetched.

### 1A — Inputs (captured once as config, never retyped)

The prompt's ~20 business inputs become durable config, not a wall of text re-pasted each run. Mapping:

| Prompt input | Lives on | Notes |
|---|---|---|
| Target country/region, audience, business model, channels, brand positioning, repeat-purchase | **Project (Brand) config** (`variables[]`, `brandKit`) | set once per brand |
| Preferred / excluded categories, price range, weight/dim limit, delivery target, fulfillment country | Project config | reusable filters |
| Testing budget, inventory budget, min pre-ad CM%, desired post-ad CM% | **Research-run form** (per run) | feed money-math + validation budget |
| Research mode (Discover / Audit), audit product/URL, # candidates, # finalists, research date | Research-run form | branches step 1 |

**Missing-input rule (CODE):** a `resolveInputs()` function fills conservative defaults and **emits an
explicit `assumptions[]` list** rendered in the output. The LLM never invents a missing budget or margin.

### 1B — The evidence ledger (the spine every step writes to)

All types live in `@lyra/shared` (pure types, zero runtime deps — invariant 1). This realizes the prompt's
"separate verified / calculated / estimate / assumption" and "source register" rules as data, not prose.

```ts
type ConfidenceKind = 'verified' | 'calculated' | 'estimate' | 'assumption';

interface EvidenceClaim {
  id: string;
  statement: string;          // "90-day search interest up ~40% in US"
  value?: number | string;    // optional structured value
  kind: ConfidenceKind;       // how this claim is known
  sourceId: string;           // -> SourceRow.id (required for 'verified'/'calculated')
  geography?: string;         // prompt rule 8: geo of every metric
  period?: string;            // prompt rule 8: time window of every metric
  demandSignal?: boolean;     // counts toward the >=3-independent-signals rule
}

interface SourceRow {         // the prompt's "source register" (output #10)
  id: string;
  name: string;
  url: string;
  accessDate: string;         // ISO; stamped by the fetch step, not the LLM
  geography?: string;
  metric?: string;
  primary: boolean;           // prompt rule 2: first-party vs specialist
  reliabilityNote?: string;
  alive: boolean;             // set false by the dead-link sweep
}
```

### 1C — User-facing view vs engine recipe

**The typed steps are the *engine recipe*, not a user wizard.** Most are CODE/ACTION steps that run
invisibly — the user never "does" the dedupe or the money-math. Collapsing the **grounded PROMPT
steps** into one mega-prompt is forbidden (that rebuilds ChatGPT with latency and kills grounding —
§0). So simplification happens at the **UI layer** (group into phases) and by trimming the
**deterministic** steps — never by flattening the fetch→extract pairs.

**What the user actually sees — 4 phases**, one input form, one decision gate:

| Phase (user-visible) | Folds in (engine steps) |
|---|---|
| **1 · Find candidates** | resolve inputs · candidate harvest · ground & dedupe |
| **2 · Validate demand & competition** | demand evidence · demand gate · competition · review mining |
| **3 · Economics & risk** | creative potential · unit economics · supply chain · risk screen |
| **4 · Score & decide** | evaluate (score + grade + decision) · save → **human gate** |

### 1C.1 — The engine recipe (trimmed)

Two merges off the original 17, **zero grounding loss**: **search + transactional demand → one
"Demand evidence"** step (several fetches, one claim set), and **score + decision → one "Evaluate"**
CODE step. The **demand gate stays early** (before review mining) — it's a cost filter: don't pay for
a 100-review fan-out on a candidate that already failed the ≥3-demand-signal rule.

`v1?` marks the thin first slice that proves the spine (grounding + demand + economics + scoring + the
human-decision UX). Everything else is v2 depth.

| # | Step | Kind | Phase | v1? | Notes / prompt origin |
|---|------|------|:--:|:--:|----------------------|
| 1 | **Resolve inputs** | CODE | 1 | ✅ | config → resolved inputs + `assumptions[]`; "missing inputs" rule |
| 2 | **Candidate harvest** | ACTION+PROMPT | 1 | ✅ | tracked competitors' long-running ads (`daysRunning`), downloaded videos, web search; Audit mode seeds one product |
| 3 | **Ground & dedupe** | ACTION/CODE | 1 | ✅ | fetch every URL, stamp `accessDate`, drop dead links, dedupe — citation integrity |
| 4 | **Customer job** | PROMPT | 2 | — | JTBD: customer, job, problem, alternative, trigger, switch reason |
| 5 | **Demand evidence** | ACTION+PROMPT | 2 | ✅ | *was search + transactional.* Search (5yr/12mo/90d, seasonality, geo, rising) + Amazon BSR/Movers, Merchant Center, TikTok Shop |
| 6 | **Demand gate** | CODE | 2 | ✅ | enforce **≥3 independent `demandSignal` claims** before the expensive steps (cost filter) |
| 7 | **Competition** | PROMPT (fan-out 5–10) | 2 | ✅ | price/offer/reviews/channels/strengths; classify healthy/dominated/commodity/emerging/underserved |
| 8 | **Review mining** | PROMPT (fan-out 100+) | 2 | — | complaint-frequency table + desired features, language, objections, returns |
| 9 | **Creative potential** | PROMPT | 3 | — | ≥5 truthful concepts + visual-benefit-speed score → seeds the creative pipeline |
| 10 | **Unit economics** | **CODE** | 3 | ✅ | CM1, break-even ROAS, max CAC, target ROAS + 3 sensitivities; LLM supplies tagged cost inputs only |
| 11 | **Supply chain** | ACTION+PROMPT | 3 | — | suppliers, MOQ, lead time, weight/dims, defect risk, certs; flag unverified as `assumption` |
| 12 | **Risk screen** | ACTION+PROMPT+CODE | 3 | — | patents, trademark, CPSC, EU Safety Gate; **CODE hard-gate**: unresolved high-severity risk → auto-fail |
| 13 | **Evaluate** | **CODE** | 4 | ✅ | *was score + decision.* Weighted-100 total + A–D grade + decision (TEST NOW / RESOLVE GAPS / LOW-COST VALIDATION / PARK / REJECT); hard-gates override score |
| 14 | **Save** | ACTION | 4 | ✅ | persist Product (Candidate) + `evidence[]` + `SourceRow[]` + economics + score + grade + decision |
| 15 | **Human gate** | GATE | 4 | ✅ | user reviews evidence; promotes Candidate → Validating. **Lyra never auto-picks.** |
| 16 | **Validation plan** | PROMPT | post-gate | — | top-N: offer, LP hypothesis, 5 creatives, channel, **test budget from max CAC**, pass/pause/kill/scale → spawns creative + posting pipelines |

**v1 = steps 1, 2, 3, 5, 6, 7, 10, 13, 14, 15** — ~10 invisible jobs that the user experiences as
*one form → progress → one gate*. **v2 adds** customer-job, review mining, creative potential, supply
chain, risk screen, and the validation plan.

Steps 1, 3 (partly), 6, 10, 12 (gate), 13 are **code** — that is the whole point. The LLM grounds and
extracts; code does every number, every threshold, every gate. Output sections 1–10 of the prompt are
rendered from the saved Product, not free-written by the model.

### 1D — Money-math (pure functions, `@lyra/shared`)

The LLM is forbidden from doing this arithmetic. It only provides tagged cost inputs.

```ts
interface UnitEconInputs {
  aov: number;            // selling price / AOV
  landedCost: number;     // product cost + inbound freight + duties
  paymentFeePct: number;
  fulfillment: number;
  shippingSubsidy: number;
  expectedReturnLossPct: number;
  warrantyReservePct: number;
  desiredPostAdCmPct: number;   // from research-run form
}
interface UnitEcon {
  cm1: number; cm1Pct: number;
  breakEvenRoas: number;        // 1 / cm1Pct
  maxCac: number;               // aov * (cm1Pct - desiredPostAdCmPct)
  targetRoas: number;           // aov / maxCac
}
function computeUnitEcon(i: UnitEconInputs): UnitEcon;

// prompt's required cases + sensitivities
function runScenarios(base: UnitEconInputs): {
  low: UnitEcon; base: UnitEcon; high: UnitEcon;
  plus10Cac: UnitEcon; plus10Landed: UnitEcon; doubleReturns: UnitEcon;
};
```

### 1E — Scoring, grading, decision (pure functions, `@lyra/shared`)

```ts
const WEIGHTS = {                 // prompt's 100-point model
  demandIntent: 15, trendDurability: 10, problemIntensity: 10, whitespace: 12,
  unitEconomics: 18, creativePotential: 10, channelFit: 7, supplyQuality: 8,
  riskCompliance: 5, expansionValue: 5,
} as const;                       // sums to 100

type SubScores = Record<keyof typeof WEIGHTS, number>;        // each 0..5 (LLM, grounded)
function weightedScore(s: SubScores): number;                 // Σ weight * score/5

function gradeConfidence(evidence: EvidenceClaim[]): 'A'|'B'|'C'|'D';
// A: direct purchase data + >=3 independent sources; B: >=3 sources no purchase test;
// C: 2 sources / substantial estimate; D: single-source / anecdotal

interface HardGates {             // any true => auto fail/pause
  unresolvedSafety: boolean; materialIpRisk: boolean; negativeUnitEcon: boolean;
  cpaExceedsMaxCac: boolean; singleSourceDemand: boolean; misleadingClaimsRequired: boolean;
}
type Decision = 'TEST_NOW'|'RESOLVE_GAPS'|'LOW_COST_VALIDATION'|'PARK'|'REJECT';
function decide(score: number, gates: HardGates): Decision;   // gates override score bands
```

### 1F — Per-step provider assignment (cost/quality)

Lyra picks a provider·model per step (the engine already supports this) — ChatGPT can't:

- **Cheap/fast model**: candidate harvest summarization, dedupe labeling.
- **Strong model**: customer-job, competition, review mining, creative concepts, validation plan.
- **No model (code)**: resolve-inputs, money-math, demand-gate, scoring, grading, decision, hard-gates.
- **Action tools**: web search + single-URL `crawl` fetch (exists), video download (exists), monitor read.

The only net-new provider remains the **agentic search loop** wrapping the existing `crawl` fetch (§3).

---

## 2. The full loop (no Shopify anywhere)

```
   ┌───────────────────────────────────────────────────────────────────┐
   │                                                                     │
   ▼                                                                     │
TRACK known competitors ──▶ HARVEST signal + DOWNLOAD their best video   │
(monitor, daysRunning)        (monitor + download tool = grounding)      │
   │                                                                     │
   ▼                                                                     │
GROUNDED RESEARCH pipeline (§1) ──▶ Product (Candidate) + evidence        │
   │                                                                     │
   ▼  human gate (pick)                                                  │
ON-BRAND CREATIVE  ──┐                                                    │
  • remix downloaded competitor video → re-branded                       │
  • generate image/video to the brand kit                                │
STORE-CONTENT KIT ───┤  (copy, sections, structure — exported, not pushed)│
   │                 │                                                    │
   ▼                 ▼                                                    │
POST to many channels (organic) ───────────────────────────────────────┘
   (keep tracking the same competitors → re-feeds the loop)
```

The same tracked competitor is both the **signal** (what's working = runs longest) and the **raw material**
(download → re-brand → post). No store API in the loop.

---

## 3. Current Lyra vs. what this needs

Based on the verified current-state map. The headline: **~80% is reuse.** Lyra's pipeline engine, prompt
library, run/asset model, monitor, connectors (download + publish), and creative providers are exactly the
substrate this loop needs.

| Capability | Current state | Verdict |
|---|---|---|
| Prompt library | Built | **Reuse** |
| Pipeline engine (prompt+action steps, gates, fan-out, `{input}`/`{step}` chaining) | Built | **Reuse — the backbone** |
| Run engine + Assets (per-step results, media) | Built | **Reuse** (creative runs) |
| Competitor monitor (Competitor/Ad/Event, daily diff, `daysRunning`) | Built | **Reuse + trim** (drop `discover`; track a user-given list) |
| Connectors: video download (yt-dlp: TikTok/FB/YT) | Built/in-progress | **Reuse** (grounding + raw material) |
| Channels + Posts (multi-channel publish) | Built | **Reuse** (distribution) |
| Render/modify video + image generation (image, gemini-image, video providers) | Built (real, not mock) | **Reuse** (on-brand creative) |
| Single-URL fetch (`crawl` provider → text+images, no key) | Built (real) | **Reuse** as the fetch primitive |
| Project (brandKit, variables, channels) | Built | **Reuse** as the Brand/Store context |
| **Product** (durable researched opportunity + lifecycle) | — | **NEW entity** |
| **Evidence/provenance model** (`{source,url,accessDate,confidence}`) | — | **NEW** |
| **Unit-economics functions** (CM1, break-even, CAC) | — | **NEW** (pure, in `@lyra/shared`) |
| **Agentic web-research loop** (multi-step search → fetch → reflect) | `crawl` does single-URL fetch; no search/loop yet | **NEW — the biggest build** (build the search+loop on top of `crawl`) |
| Product lifecycle status (Candidate→…→Killed) | — | **NEW** (manual board, like Task.status) |
| Shopify connector / store provisioning | — | **Drop** (out of scope) |
| Conversion tracking / Listing-conversion join | — | **Drop** |
| Paid-ads / campaign / stat-snapshot subsystem | — | **Drop** |

Net-new is small and well-bounded: a **Product** entity, an **evidence model**, **money-math**, a **grounded
research provider**, and a **monitor trim**. Everything else exists.

---

## 4. Re-architected data model (simplified — Shopify-free)

**`Product` and `Task` are PEERS under `Project` — not nested.** Product is a durable *property/asset* of the
Project; Task is a transient *scope of work* finished by running a pipeline. They connect by **reference, not
hierarchy**: work that serves a product carries a `productId`. Neither contains the other.

```
Workspace
 └─ Project                ◀── the brand/context CONTAINER (brandKit, variables, channels)   [EXISTS, unchanged]
     ├─ Product            ◀── durable researched ASSET; owns evidence + economics + lifecycle [NEW]
     │     status: Candidate→Validating→Testing→Scaling→Declining/Killed (manual)
     │     evidence[] + SourceRow[] + unitEcon + score + grade + decision
     │       ▲                                   ▲
     │       │ productId (ref)                   │ ref (which competitors fed it)
     │       │                                   │
     └─ Task ─┘  ◀── transient WORK; pipelines[], status, assignee     [EXISTS, unchanged]
          └─ Run ──▶ Asset   ◀── execution + media; Run gains optional productId  [EXISTS, + link]
                 └─ (Posts reference productId too)

 Monitor (Competitor/MonitorAd/AdEvent) — tracks the user's KNOWN competitor list   [EXISTS, trim discover]
```

Far simpler than the Shopify-era proposal: **no Listing join, no conversion snapshots, no campaign/ad
entities.** `Product` owns its research evidence (mirrors the `Prompt.results[]` pattern). Lifecycle status
is a manual board state (no metrics to auto-advance it), like `Task.status`. Naming: keep `Project` in code,
surface as **"Brand"** in the UI; `Product` (use **"Opportunity"** only if it ever collides with a literal SKU).

### Entity scope (the boundary the implementation must respect)

**Project = the WHO/WHERE — brand identity, shared context, access boundary.** Does no work and holds no
research. Fields: `name`, `description`, `brandKit`, brand positioning, `variables[]` (niche, audience,
product-type, homepage), `channels[]`, `status`/`shared`/`sharedWith[]`, and brand-stable research inputs
(country/region, audience, business model, primary channels, preferred/excluded categories, price range,
delivery target, fulfillment country, max weight/dims). Owns Products and Tasks as peers.

**Product = the WHAT — the durable researched opportunity and everything known/decided about it.** Executes
nothing. Fields: `name`, source URL/ref, niche/category; lifecycle `status`; `evidence[]` + `SourceRow[]`;
`unitEcon`; `score` + confidence `grade` (A–D) + `decision`; product-level economics inputs (target price,
testing budget, inventory budget, min pre-ad CM%, desired post-ad CM%); references to the competitors that
fed it; a manual outcome field ("did it sell?"). Lives under Project (`workspaceId` + `projectId`).

**Task = the WORK — a scope of work finished via a pipeline.** Transient. Fields (unchanged): `pipelines[]`,
`status`, `assigneeId`, `tags`. Produces Runs/Assets. References the Product it serves via `productId` when
the work is creative for that product. Never contains a Product; never owned by a Product.

### Scope of work for the implementing agent

**BUILD (new):**
- `Product` module mirroring the `Task` module shape — schema (`workspaceId` + `projectId` + the Product
  fields above), service, controller under `/workspaces/:id/projects/:projectId/products`, reusing
  `ProjectAccessGuard` for visibility (no new access logic).
- `@lyra/shared`: `Product` model type, `ProductStatus` lifecycle enum, `EvidenceClaim` + `SourceRow` +
  `ConfidenceKind` types, `UnitEcon*` types, the `WEIGHTS` constant + scoring/grading/decision pure
  functions, and the money-math pure functions (§1D/1E). DTO *interfaces* in shared; class-validator DTO
  classes in the api that `implements` them (invariant 2). Add Vitest unit tests for the pure functions.
- Extend the cascade-delete service so deleting/soft-deleting a `Project` also cleans up its `Product`s.

**UNCHANGED (do not touch):**
- `Project` schema/service/guards — additive only; Product references Project, never the reverse.
- `Task` schema — stays a pure work-unit.
- Pipeline engine, Run/Asset model, Prompt library, Channels/Posts.

**DEFER (additive, nullable, wire per loop stage — none touch Project):**
- `Run.productId?` (and/or `Task.productId?`) — attribute creative work to a Product.
- `PublishedPost.productId?` — attribute posts to a Product.
- Product↔Competitor association (store `competitorIds[]` on Product, or a thin join).
- Monitor trim (make `discover` optional; allow adding a known competitor directly).
- The agentic web-research loop (§3) — the one large net-new capability.

**INVARIANTS that still bind:** workspace-scoped queries (5); shared has zero runtime deps (1); server-only
fields never leave the api (3); access enforced via shared helpers / `ProjectAccessGuard` (4); soft-delete +
audited like every collection.

---

## 5. Business re-architecture

**The real shift is toolkit → opinionated vertical.** Today Lyra is "a set of tools" — a generic prompt +
pipeline toolkit. That's flexible but it's a commodity, and a blank canvas is exactly why horizontal AI
tools don't retain: no opinion, no workflow, the user has to assemble everything. The re-architecture is to
make those generic tools **cohere into one opinionated workflow — the loop in §2 — for one user
(dropshippers)**, while keeping the pipeline/prompt engine underneath as the extensible substrate for power
users. Vertical wins retention; the engine keeps you flexible. Don't stay purely horizontal — that's where
you dissolve into the commodity AI-tool noise.

**Positioning.** Not "AI store builder" (crowded, and you don't touch Shopify). Not "we find winning
products" (you can't certify them). Instead: *"Track your competitors, get evidence-backed product
candidates, and turn the winners into differentiated, on-brand creative and store content you post to your
channels — one grounded loop, no fake numbers, no copy-paste."*

**Wedge** (each tied to a validated market pain from the competitive research):
- **Brand-consistency / anti-saturation** — every other tool hands users the same catalog row + a generic
  template; Lyra generates differentiated, brand-anchored creative + content per user. Attacks the #1
  structural pain (saturation) and the "generic AI output" pain.
- **Grounded + honest** — provenance, confidence tags, dead-link sweep, money-math-in-code. The direct
  antidote to the category's universal trust deficit (inflated/unverified estimates).
- **The seamless light loop** — replaces a $200–300/mo stack of disconnected point tools and the copy-paste
  between them, without trying to out-feature AutoDS.

**Honest positioning reality.** Late entrant, crowded space, and — having dropped Shopify/ads — **no
conversion moat**. Compete on trust + brand-fit + workflow cohesion + a sharp ICP, not on breadth.

**Monetization.** BYO provider keys (no markup, matches current architecture) + subscription. Make
**transparent billing and one-click cancellation an explicit promise** — a real differentiator given that
billing/cancellation traps are a near-universal complaint about every competitor.

---

## 6. Build sequence (risk-ordered)

1. **Product entity + evidence/provenance model + unit-economics functions** (`@lyra/shared`). The spine —
   cheap, deterministic, fully testable. Do this first.
2. **Grounded web-research provider** (search + fetch agent loop). The biggest net-new capability and the
   one the whole "find winners" promise rests on. Build and verify carefully — grounding is where trust is
   won or lost.
3. **Product-research pipeline template (v1 thin slice)** — assemble the §1C.1 **v1 steps** (resolve →
   harvest → ground → demand + gate → competition → unit-economics → evaluate → save → gate) from the
   existing pipeline engine, surfaced as the **4-phase user view**. Defer review-mining, creative-potential,
   supply-chain, risk-screen, and the validation plan to **v2** — prove the cheap deterministic spine first.
4. **Monitor trim** → known-competitor tracking; wire competitor `daysRunning` signal into step 2.
5. **Creative loop** — download → modify/brand → on-brand image/video → store-content kit; re-parent
   Runs/Posts to Product.
6. **Distribution** — posting to channels (exists) tied to Product.
7. **Opinionated UI** — the loop as the default workspace (Product board + lifecycle + evidence view); the
   toolkit (pipelines/prompts) remains underneath for power users.

---

## 7. What I'd still push back on

- **Tracking-only caps research at "what my known competitors already do"** — i.e. somewhat saturated and
  *followed*, not first. Acceptable to start, but plan to re-introduce light discovery later or you ceil
  out at copying.
- **The loop never closes objectively.** With no conversion and no ad data, winner judgment stays
  human + competitor-proxy forever. Accept it — but add a cheap **manual "did it sell? / outcome" field on
  Product** so you at least accumulate your *own* ground truth over time. It's the only first-party signal
  you'll have, and it costs almost nothing.
- **Grounding is the make-or-break, not a nice-to-have.** A prompt-only "find winners" with no fetch is
  precisely the fake-number tool users distrust. If only one thing on the build list is done excellently,
  make it the web-research provider (#2).
```
