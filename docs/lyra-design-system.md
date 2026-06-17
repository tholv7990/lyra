---
name: Lyra
version: 1.0
description: >-
  Linear-style, LIGHT-mode design system built around a single warm orange
  accent. White canvas with a light surface ladder, thin hairline borders,
  subtle flat shadows, modest 8–12px radii, and Inter throughout. Live source of
  truth: apps/web/src/styles/tokens.css. (The dark, Apple-style spec further down
  is archived for reference only.)

colors:
  # Brand & Accent
  primary: "#FF6B1A"
  primary-hover: "#FF7D35"
  primary-pressed: "#E25A0E"
  primary-tint: "rgba(255,107,26,0.12)"
  primary-glow: "rgba(255,107,26,0.34)"
  on-primary: "#FFFFFF"
  secondary-gold: "#C9A060"
  # Surface (Apple dark ladder)
  canvas: "#000000"
  surface-1: "#1C1C1E"
  surface-2: "#2C2C2E"
  surface-3: "#3A3A3C"
  surface-4: "#48484A"
  field: "#161618"
  hairline: "rgba(255,255,255,0.09)"
  hairline-strong: "rgba(255,255,255,0.14)"
  hairline-tertiary: "rgba(255,255,255,0.06)"
  # Text
  ink: "#F5F5F7"
  ink-muted: "rgba(235,235,245,0.60)"
  ink-subtle: "rgba(235,235,245,0.30)"
  ink-tertiary: "rgba(235,235,245,0.18)"
  # Semantic
  success: "#30D158"
  warning: "#FF9F0A"
  danger: "#FF453A"
  info: "#0A84FF"
  overlay: "rgba(0,0,0,0.60)"
  # Inverse (rare light sections)
  inverse-canvas: "#FFFFFF"
  inverse-ink: "#1D1D1F"

typography:
  families:
    display: "Inter, 'SF Pro Display', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    text: "Inter, 'SF Pro Text', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
  scale:
    display-xl: { size: 80, weight: 700, line: 1.05, tracking: "-2.5px" }
    display-lg: { size: 56, weight: 700, line: 1.08, tracking: "-1.6px" }
    display-md: { size: 40, weight: 600, line: 1.12, tracking: "-1.0px" }
    headline:   { size: 28, weight: 600, line: 1.20, tracking: "-0.5px" }
    card-title: { size: 22, weight: 600, line: 1.25, tracking: "-0.4px" }
    subhead:    { size: 20, weight: 500, line: 1.40, tracking: "-0.2px" }
    body-lg:    { size: 18, weight: 400, line: 1.50, tracking: "-0.1px" }
    body:       { size: 16, weight: 400, line: 1.50, tracking: "-0.01em" }
    body-sm:    { size: 14, weight: 400, line: 1.50, tracking: "0" }
    caption:    { size: 12, weight: 500, line: 1.40, tracking: "0.2px" }
    button:     { size: 15, weight: 600, line: 1.20, tracking: "-0.01em" }
    eyebrow:    { size: 12, weight: 600, line: 1.30, tracking: "0.12em", transform: "uppercase" }
    mono:       { size: 12, weight: 400, line: 1.50, tracking: "0" }

spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, section: 96 }
rounded: { xs: 6, sm: 8, md: 12, lg: 18, xl: 22, xxl: 28, pill: 980, full: 9999 }
---

> **⚠️ Superseded — read this first.** Lyra's UI is a **Linear-style, LIGHT-mode**
> system, not the dark Apple style described from "## Overview" down. The **live
> source of truth is [apps/web/src/styles/tokens.css](../apps/web/src/styles/tokens.css)**
> (plus `apps/web/src/index.css`). The marketing landing
> (`apps/web/src/pages/Landing.tsx` + `landing.css`) follows the system below.
> The dark spec is kept only as a reference archive.

## Current system (Linear, light)

**Philosophy.** Calm, flat, content-first — Linear's restraint, not Apple's
cinematic dark. A white canvas, a light surface ladder for hierarchy, thin
hairline borders, and subtle/flat shadows. Orange stays the single brand accent,
used scarcely (eyebrow, primary action, focus/active, link emphasis).

**Palette** (from `tokens.css`):
- Canvas `#FFFFFF`; surfaces `#F9F9FB` → `#F1F1F4` → `#E9E9EE` → `#E1E1E6`; field `#FFFFFF`.
- Hairlines `rgba(0,0,0,.08)` · `.13` strong · `.05` faint.
- Ink `#1D1D1F`; muted `rgba(60,60,67,.62)`; subtle `.40`; tertiary `.24`.
- Brand orange `#FF6B1A` (hover `#FF7D35`, pressed `#E25A0E`, tint `rgba(255,107,26,.14)`).
- Semantic: success `#2DA44E` · warning `#D98300` · danger `#E5484D` · info `#0A84FF`.

**Type.** Inter throughout (display/text with `SF Pro`/system fallbacks);
`JetBrains Mono` for IDs, status tokens, and code. Negative tracking on display,
near-neutral on body.

**Shape & depth.**
- Radii in use: **8px** (controls) and **12px** (cards/inputs); larger radii exist but are rarely used.
- Shadows are subtle and flat (`--shadow-1` / `--shadow-2`). **No glow.**
- Buttons are **not pills** — modest-radius solids and ghosts. The orange CTA is a flat solid (no halo).

**Reversals from the archived dark spec (below):**
- Canvas is **white**, not pure black; surfaces are a **light** ladder; ink is dark on light.
- A light marketing page **is** the norm — the old "don't ship a light-mode marketing page" rule no longer applies.
- **No** signature orange glow and **no** fully-rounded pill CTAs.

> A full line-by-line rewrite of the component specs below is still pending. Until
> then, defer to `tokens.css` for any conflict.

---

> **Archived below — dark, Apple-style spec. Reference only; not the current system.**

## Overview

Lyra's surface is a **pure-black Apple system** — `{colors.canvas}` is true `#000000`, an OLED anchor that lets product photography and the orange accent carry every section. On top sits a four-step surface ladder (`{colors.surface-1}` → `{colors.surface-4}`) for cards, panels, and lifted tiles, separated by hairline borders from `{colors.hairline}` up through `{colors.hairline-strong}`. Off-white text (`{colors.ink}` #F5F5F7) carries body and headlines.

The single chromatic accent is **Lyra orange** `{colors.primary}` (#FF6B1A) — used scarcely on the brand mark, the primary CTA, focus rings, and active states. A lighter hover (`{colors.primary-hover}` #FF7D35) and a deeper pressed tone (`{colors.primary-pressed}` #E25A0E) extend the same hue, and a low-alpha `{colors.primary-tint}` powers focus rings and quiet fills. The only warm secondary is `{colors.secondary-gold}` (#C9A060), held in reserve for premium detail. Semantic colors (success, warning, danger, info) appear only on status, never as decoration.

Display type runs **Inter** (with `SF Pro Display` fallback) at weight 600–700 with negative letter-spacing scaling from -2.5px at 80px down to ~0 at body. A `JetBrains Mono` cut is reserved for technical labels, IDs, and code.

Two moves make Lyra distinct from a typical cool, flat dark system: **fully-rounded pill CTAs** (`{rounded.pill}` 980px) and a **signature orange glow** beneath the primary button. The chrome stays minimal and Apple-quiet; the product, the pill, and the glow do the talking. The brand voice is **considered, confident** — calm, exacting, no hype.

**Key Characteristics:**
- **Pure-black Apple canvas** — `{colors.canvas}` is true `#000000`, intentional for OLED depth.
- **Single warm accent** (`{colors.primary}` #FF6B1A) — brand mark, primary CTA, focus, active state. Nothing else.
- Four-step surface ladder (canvas → surface-1 → surface-4) carries hierarchy with hairlines, not heavy shadow.
- Display tracking pulls negative (-2.5px at 80px); body holds at -0.01em.
- **Pill CTAs** at `{rounded.pill}` 980px; cards at `{rounded.lg}` 18px — large, soft, Apple-scale corners.
- **Orange glow** on the primary CTA is the signature lift — the one place light leaks onto the dark.
- Restrained warm secondary (`{colors.secondary-gold}`); no competing chromatic accent.

## Colors

### Brand & Accent
- **Orange** (`{colors.primary}`): The signature Lyra accent — primary CTA, brand mark, link emphasis, active state.
- **Orange Hover** (`{colors.primary-hover}`): Lighter orange (#FF7D35) — hovered primary CTA.
- **Orange Pressed** (`{colors.primary-pressed}`): Deeper orange (#E25A0E) — pressed CTA, and orange *text* on light surfaces where #FF6B1A is too light for contrast.
- **Orange Tint** (`{colors.primary-tint}`): Low-alpha orange — focus-ring fill, quiet selected backgrounds.
- **Orange Glow** (`{colors.primary-glow}`): The CTA glow — a soft 0 0 26px halo under the primary button.
- **Gold** (`{colors.secondary-gold}`): Muted warm gold (#C9A060) — premium detail, dividers in editorial sections. Used sparingly.

### Surface
- **Canvas** (`{colors.canvas}`): Default page background — true `#000000`.
- **Surface 1** (`{colors.surface-1}`): One step above — feature cards, product panels, inputs-in-context.
- **Surface 2** (`{colors.surface-2}`): Two steps above — featured cards, hovered cards, status pills.
- **Surface 3** (`{colors.surface-3}`): Three steps above — sub-nav, dropdown menus.
- **Surface 4** (`{colors.surface-4}`): Deepest lifted surface — nested controls, tooltips.
- **Field** (`{colors.field}`): Input fill (#161618) — slightly darker than surface-1 so fields read inside cards.
- **Hairline** (`{colors.hairline}`): 1px borders on cards and dividers.
- **Hairline Strong** (`{colors.hairline-strong}`): Stronger 1px borders — featured cards, emphasized dividers.
- **Hairline Tertiary** (`{colors.hairline-tertiary}`): Faint borders for nested surfaces.

### Text
- **Ink** (`{colors.ink}`): All headlines and emphasized body — off-white #F5F5F7.
- **Ink Muted** (`{colors.ink-muted}`): Secondary type — lead/meta on dark panels.
- **Ink Subtle** (`{colors.ink-subtle}`): Tertiary type — captions, deselected tabs, footer columns.
- **Ink Tertiary** (`{colors.ink-tertiary}`): Quaternary — disabled, footnotes, placeholders.

### Semantic
- **Success** (`{colors.success}`): #30D158 — completion, success pills, "done" states.
- **Warning** (`{colors.warning}`): #FF9F0A — caution, pending. Kept distinct from brand orange by being yellower.
- **Danger** (`{colors.danger}`): #FF453A — errors, destructive actions.
- **Info** (`{colors.info}`): #0A84FF — neutral/in-progress status only; never a second brand accent.
- **Overlay** (`{colors.overlay}`): Black scrim for modals and sheets.

> **Orange vs. Warning:** brand orange (#FF6B1A) and the warning amber (#FF9F0A) are deliberately close. Never use them adjacently on the same control — orange means *brand/action*, amber means *caution*.

## Typography

### Font Family
- **Inter (Display)** — headlines and display marks; fallback `SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto`. Carries display-xl through subhead.
- **Inter (Text)** — body sizes, button labels, captions; same fallback stack.
- **JetBrains Mono** — technical labels, IDs, step/status tokens, code; fallback `ui-monospace, SF Mono, Menlo`.

Display and Text are one continuous Inter voice; the family note is conceptual, not a real switch.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 80px | 700 | 1.05 | -2.5px | Largest hero headline |
| `{typography.display-lg}` | 56px | 700 | 1.08 | -1.6px | Section opener headlines |
| `{typography.display-md}` | 40px | 600 | 1.12 | -1.0px | Sub-section headlines |
| `{typography.headline}` | 28px | 600 | 1.20 | -0.5px | CTA banner heading, tier titles |
| `{typography.card-title}` | 22px | 600 | 1.25 | -0.4px | Feature / product card title |
| `{typography.subhead}` | 20px | 500 | 1.40 | -0.2px | Lead body, intro paragraphs |
| `{typography.body-lg}` | 18px | 400 | 1.50 | -0.1px | Hero subhead, lead paragraphs |
| `{typography.body}` | 16px | 400 | 1.50 | -0.01em | Default body |
| `{typography.body-sm}` | 14px | 400 | 1.50 | 0 | Card body, footer columns |
| `{typography.caption}` | 12px | 500 | 1.40 | 0.2px | Captions, meta |
| `{typography.button}` | 15px | 600 | 1.20 | -0.01em | All button labels |
| `{typography.eyebrow}` | 12px | 600 | 1.30 | 0.12em ·UPPER | Section eyebrow / taxonomy |
| `{typography.mono}` | 12px | 400 | 1.50 | 0 | JetBrains Mono for labels, IDs, code |

### Principles
- **Negative tracking on display** (-2.5px at 80px) — Inter needs slightly less than a custom face; keep it tight, not collapsed.
- **One voice from display to body** — Inter throughout; impact comes from weight (700 → 400) and size, not a font swap.
- **Eyebrows go uppercase with positive tracking** (+0.12em) — the inverse of the negative-tracked display marks them as taxonomy.
- **Mono only for the technical register** — IDs, step keys, status, code. Never for marketing prose.

### Note on Font Substitutes
**Inter** is the canonical face (free, open-source) and the recommended substitute for SF Pro on cross-platform. **Geist Sans** is also viable. For mono, **JetBrains Mono** or **Geist Mono** at weight 400. On Apple platforms, `-apple-system` / SF Pro is an acceptable system fallback.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 48 · `{spacing.section}` 96.
- Card interior padding: `{spacing.lg}` 24 on feature/product cards; `{spacing.xl}` 32 on testimonial cards; `{spacing.xxl}` 48 on CTA banners.
- Pill button padding: 13px vertical · 30px horizontal (primary); 11px · 22px (compact).
- Form input padding: 11px vertical · 12px horizontal.

### Grid & Container
- Max content width **1200px**.
- Card grids: 3-up desktop, 2-up tablet, 1-up mobile.
- Product hero / screenshot panels span full content width — the protagonist.

### Whitespace Philosophy
The black canvas IS the whitespace. Sections separate by lifting onto `{colors.surface-1}` panels, not by gaps in white. Within a panel, `{spacing.lg}` 24 between blocks; `{spacing.section}` 96 between sections.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow, no border | Body type, hero text, footer |
| 1 (surface lift) | `{colors.surface-1}` + 1px `{colors.hairline}` + soft shadow `0 1px 2px / 0 6px 22px rgba(0,0,0,.5)` | Default cards, product panels |
| 2 (raised) | `{colors.surface-2}` + 1px `{colors.hairline-strong}` | Featured cards, hovered cards, menus |
| 3 (overlay) | `{colors.surface-3}` + overlay scrim behind | Dropdowns, sheets, tooltips |
| glow (signature) | Orange halo `0 0 26px {colors.primary-glow}` under the element | Primary CTA only |
| focus | 3px `{colors.primary-tint}` ring + 1px `{colors.primary}` border | Focused input, focused button |

Lyra depth is carried by the surface ladder + hairlines + soft Apple shadows. The one expressive exception is the **orange glow**, reserved exclusively for the primary CTA.

### Decorative Depth
- **Cinematic product photography** is the primary decorative depth — dark, graded, calm.
- **The orange glow** is the single light source; do not scatter glows across the page.
- Optional **faint top-edge highlight** (1px inner `rgba(255,255,255,.06)`) on lifted panels for a crisp "rendered" edge.
- No rainbow gradients, no spotlight-card clusters.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 6px | Status badges, small chips |
| `{rounded.sm}` | 8px | Inline tags, mode pills |
| `{rounded.md}` | 12px | Inputs, compact/secondary buttons |
| `{rounded.lg}` | 18px | Feature, product, testimonial cards |
| `{rounded.xl}` | 22px | Large panels, hero/product tiles |
| `{rounded.xxl}` | 28px | Oversized CTA banners (rare) |
| `{rounded.pill}` | 980px | **Primary & secondary buttons, toggles, status pills** |
| `{rounded.full}` | 9999px | Avatar circles, the Ly app-icon |

> **The pill is the signature.** Primary and secondary CTAs are fully rounded (`{rounded.pill}`). Cards stay at the large-but-rectangular `{rounded.lg}` 18px so buttons read as the rounded actors against softer panels.

### Photography & Illustration Geometry
- Product photography sits in `{rounded.xl}` 22px tiles with `{spacing.lg}` 24 outer padding; dark, color-graded, never harshly lit.
- The **Ly brand mark** is an orange gradient rounded square (`{rounded.full}`-adjacent app-icon, ~9px radius at 34px) with white "Ly".
- Avatar circles in testimonials use `{rounded.full}` at 32–40px.

## Components

### Buttons

**`button-primary`** — Orange pill with glow. The default CTA across all surfaces.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}`, padding 13px 30px, rounded `{rounded.pill}`, shadow `0 0 26px {colors.primary-glow}`.
- Hover → `{colors.primary-hover}` + stronger glow. Pressed → `{colors.primary-pressed}`, glow removed. Disabled → `{colors.surface-2}` fill, `{colors.ink-tertiary}` text, no glow.

**`button-secondary`** — Ghost pill. Secondary CTAs ("Sign in", "Learn more").
- Background transparent, text `{colors.ink}`, 1px `{colors.hairline-strong}` border, type `{typography.button}`, padding 13px 30px, rounded `{rounded.pill}`. Hover → border brightens, faint `{colors.surface-1}` fill.

**`button-tertiary`** — Plain text button.
- Background none, text `{colors.ink}` (or `{colors.primary}` for emphasis), type `{typography.button}`, rounded `{rounded.pill}`, padding 11px 18px.

**`button-inverse`** — White pill for the rare light/section opener.
- Background `{colors.inverse-canvas}`, text `{colors.inverse-ink}`, rounded `{rounded.pill}`, padding 13px 30px.

### Toggles & Tabs

**`pill-toggle`** (default + selected) — segmented control.
- Default: transparent, `{colors.ink-subtle}` text, rounded `{rounded.pill}`, padding 9px 16px.
- Selected: `{colors.surface-2}` fill, `{colors.ink}` text — selection = surface lift. (Active item may take a `{colors.primary}` text tint.)

### Cards & Containers

**`feature-card`** — Generic feature tile.
- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.lg}`, padding 24px, 1px `{colors.hairline}`, soft shadow.

**`product-card`** — The dominant card — frames cinematic product photography.
- Background `{colors.surface-1}`, rounded `{rounded.xl}`, padding 24px, 1px `{colors.hairline}`. Image graded to the dark palette.

**`feature-card-featured`** — Emphasized tile — lift to surface-2.
- Background `{colors.surface-2}`, 1px `{colors.hairline-strong}`, otherwise identical.

**`testimonial-card`** — Customer quote with avatar + name + role.
- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body-lg}`, rounded `{rounded.lg}`, padding 32px.

**`cta-banner`** — Closing CTA panel near page bottom.
- Background `{colors.surface-1}` (optionally with a faint orange radial top-glow), text `{colors.ink}`, type `{typography.headline}`, rounded `{rounded.xl}`, padding 48px, with a `button-primary` inside.

### Inputs & Forms

**`text-input`** (+ focused) — Form fields.
- Background `{colors.field}`, text `{colors.ink}`, placeholder `{colors.ink-tertiary}`, type `{typography.body}`, rounded `{rounded.md}`, padding 11px 12px, 1px `{colors.hairline-strong}`.
- Focused: background lifts toward `{colors.surface-1}`, border → `{colors.primary}`, plus a 3px `{colors.primary-tint}` ring.

### Status

**`status-badge`** — Small status pill.
- Background `{colors.surface-2}`, text `{colors.ink-muted}`, type `{typography.caption}`, rounded `{rounded.pill}`, padding 3px 9px. Semantic dot (success/warning/danger/info) optional at left.

**`mode-tag`** — Tiny technical tag (e.g., "AUTO", "GATE").
- Background `{colors.field}` (or `{colors.primary-tint}` for active), text `{colors.ink-muted}` / `{colors.primary}`, type `{typography.mono}`, rounded `{rounded.sm}`, padding 2px 7px, 1px hairline.

### Navigation

**`top-nav`** — Sticky bar: Ly mark + wordmark left, nav links, a `button-secondary` + `button-primary` pair right.
- Background `{colors.canvas}` with a translucent blur (`rgba(0,0,0,.6)` + backdrop-blur), text `{colors.ink}`, type `{typography.body-sm}`, height 56px, 1px `{colors.hairline}` bottom.

### Footer

**`footer`** — Dense link grid on `{colors.canvas}` with the Ly wordmark left.
- Background `{colors.canvas}`, text `{colors.ink-subtle}`, type `{typography.caption}`, padding 64px 32px.

### Brand Mark

**`logo-mark`** — Orange-gradient rounded square, white "Ly".
- Background `linear-gradient(160deg,#FF8A3D,{colors.primary})`, text `{colors.on-primary}`, weight 800, rounded ~9px at 34px, soft orange shadow `0 2px 10px {colors.primary-glow}`.

## Do's and Don'ts

### Do
- Keep `{colors.canvas}` true `#000000` as the anchor — it's intentional for OLED depth.
- Use `{colors.primary}` orange ONLY for: brand mark, primary CTA, focus ring, link emphasis, active state.
- Use the four-step surface ladder for hierarchy; don't skip levels.
- Make CTAs **fully-rounded pills** (`{rounded.pill}`) — the Lyra signature.
- Reserve the **orange glow** for the primary CTA — one light source per view.
- Pair display weight 600–700 with body weight 400; apply negative tracking on display.
- Grade product photography to the dark palette; let it lead sections.

### Don't
- Don't ship a light-mode marketing page (light mode is product-app only).
- Don't use orange as a section background or large card fill — it's an accent, not a surface.
- Don't introduce a second chromatic brand accent (pink, green, purple). Gold is the only warm secondary, used sparingly.
- Don't scatter glows — no glow on cards, inputs, or text.
- Don't square-corner the CTAs; the pill is load-bearing for the brand.
- Don't place brand orange next to warning amber on the same control.
- Don't add rainbow gradients or spotlight-card clusters.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Desktop-XL | 1440px | Default desktop layout |
| Desktop | 1200px | Card grid 3-up maintained (container cap) |
| Tablet | 1024px | Card grid 3-up → 2-up |
| Mobile-Lg | 768px | Nav → hamburger; stacked sections |
| Mobile | 480px | Single-column; display-xl scales 80px → ~36px |

### Touch Targets
- CTAs hold ≥44px tap height across viewports (the pill already exceeds this).
- Toggle pills hold ≥36px, growing to ≥44px on touch.
- Form inputs hold ≥44px tap target on touch.

### Collapsing Strategy
- **Top nav:** links collapse to hamburger below 768px.
- **Card grids:** 3-up → 2-up at 1024px → 1-up below 768px.
- **Display type:** `{typography.display-xl}` 80px scales toward `{typography.display-md}` 40px on mobile.
- **CTA banners:** padding `{spacing.xxl}` 48 → `{spacing.xl}` 32 below 768px.

### Image Behavior
- Product photography maintains aspect ratio and never crops awkwardly; art-direct crops per breakpoint.
- The orange glow scales down with the button; never let it bloom past the card edge on mobile.

## Iteration Guide
1. Focus on ONE component at a time and reference it by its `components:` token name.
2. When introducing a section, decide first which surface lift it lives on.
3. Default body to `{typography.body}` at weight 400.
4. Run `npx @google/design.md lint DESIGN.md` after edits.
5. Add new variants as separate component entries.
6. Treat orange as scarce: brand mark, primary CTA, focus, link/active emphasis.
7. Reserve the glow for the one primary CTA in view.

## Known Gaps
- The surface ladder maps to Apple's iOS/macOS dark system backgrounds (`#1C1C1E`, `#2C2C2E`, …); adjust if a warmer charcoal is preferred.
- The pure-black canvas is intentional for OLED; if banding appears on non-OLED panels, a near-black `#050506` is an acceptable canvas alternative.
- Form-field error/validation styling beyond border color is not yet specified.
- Light mode is documented only as the inverse tokens for rare section openers; the in-product app may define a fuller light theme separately.
- Inter is the open substitute for SF Pro; if a licensed display face is adopted later, keep the negative-tracking spec.
- Motion (CTA glow pulse, card hover lift timing) is not yet tokenized — define once the front-end is in build.
