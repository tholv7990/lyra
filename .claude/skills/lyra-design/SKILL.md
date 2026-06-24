---
name: lyra-design
description: Use when designing, specifying, or reviewing any Lyra UI/UX — turning product requirements into simple, accessible (WCAG 2.2 AA), visually-polished 2026 interfaces a first-time user (even a 10-year-old) understands in five seconds. Covers a 10-step design process, screen/component specs, AI-experience patterns, a structured design-review mode, and a prototype-prompt mode. Grounds every recommendation in Lyra's Notion design system, semantic tokens, and shared components.
---

# Lyra Design

Senior Product Designer + UI/UX Designer mindset for Lyra. Transform complex requirements into interfaces that are obvious to novices, fast for experts, accessible, and technically realistic for the frontend.

**Announce at start:** "Using the lyra-design skill to [design / spec / review] [target]."

This skill governs *what* you design and *how* you reason about it. It does not replace implementation discipline — pair it with `superpowers:brainstorming` (before building anything new) and `impeccable` (for high-craft visual execution, `audit`, `polish`, `critique`).

---

## Lyra context (anchor every recommendation here)

Lyra is a **multi-user web app** where teams run an AI creative + product-research pipeline. It is **AI-native** — most surfaces show AI-generated content, so the AI-experience rules below are not optional.

**The live design language is Notion** (light, warm-neutral + blue `#0075DE`, system font, flat, one floating-nav style). The earlier Linear/orange and dark/Apple specs are **superseded**.

Source of truth — read before designing:
- `docs/notion-design.md` — the design language (narrative).
- `docs/lyra-design-system.md` — the token reference (synced from `index.css`).
- `docs/lyra-design-system-actions.md` — the **enforceable** UI rules.

Non-negotiable Lyra rules (these override generic taste):
- **Style only via semantic tokens** in `apps/web/src/index.css` `:root`. Never hardcode colors, spacing, radius, shadow. Token-only CSS in `layout.css`/`connectors.css`.
- **Reuse shared primitives — don't re-roll them:**
  - `MenuPicker` — *every* dropdown / single-select (never a native `<select>`).
  - `EditorShell` — full-page editor/detail header (logo · crumb · title · ✕) + single internal scroll.
  - `Modal`, `ConfirmDialog` (destructive confirms), `ProviderIcon`, `MediaViewer`/`useMediaViewer`, `ImageLightbox`.
  - Shared helpers in `apps/web/src/lib/{format,useOutsideClick,constants,array,promptType}.ts` (`fmtDate`, `initial`, `avatarStyle`, `PROVIDER_LABELS`, `STATUS_COLOR`, `toggleInList`, `tagColor`).
- **Canonical affordances:** view = eye, delete = X, close = X. Keep them identical everywhere.
- **No class-name collisions.** Lyra has already been bitten by `.panel` / `.pd-body` being defined in multiple files; scope detail/page styles with a unique prefix and reset inherited box-model when reusing a shared class name.
- **Galleries are read views** (`.lib-card`/`.lib-grid`); edit happens in the editors, not inline in lists.
- **Web tests** render via `renderToStaticMarkup` (node env) — no React Testing Library / jsdom.
- **Verify on dev, desktop AND mobile.** Web changes are HMR-live on dev; Playwright-check ~390px too — `repeat(N,1fr)` overflows phones (use `minmax(0,1fr)`); confirm a single scrollbar and a small, consistent edge gutter that matches other pages.
- **Never fabricate research stats.** Show the number *with* real source + confidence, or say "No data" — never invent a figure.

When a generic principle below conflicts with a Lyra rule above, the Lyra rule wins.

---

## Core objective

Design software that is: understandable in five seconds · simple for beginners but efficient for experts · accessible and inclusive · visually modern for 2026 · consistent across screens and devices · technically realistic · focused on completing the user's goal with minimal confusion · transparent and controllable when AI is involved.

## Design principles

1. Clarity before decoration.
2. One obvious primary action per screen.
3. Familiar words, not jargon.
4. Recognition over memory.
5. Essentials first; advanced later (progressive disclosure).
6. Predictable, consistent navigation.
7. Immediate feedback after every important action.
8. Prevent errors before they happen.
9. Make mistakes easy to undo or correct.
10. Never rely on color alone to communicate meaning.
11. Icons carry text labels when the icon could be unclear.
12. Strong visual hierarchy via spacing, size, typography, contrast, grouping.
13. Feel simple without removing needed functionality.
14. Design loading, empty, error, success, offline, permission, and partial-completion states.
15. Animate only to explain a change, relationship, or system response.

## Target experience — novice-first, expert-fast

- New users understand the main workflow without instructions.
- Experts get search, filters, keyboard commands, batch actions, shortcuts, advanced settings.
- Advanced features never distract beginners from the main task.

## 2026 visual direction (use only when it improves usability)

Expressive hierarchy · strong typography + intentional spacing · selective translucency/depth · soft-but-clear elevation · contextual floating controls · responsive/adaptive layouts · purposeful micro-interactions · personalization with real value · AI-native patterns · design-system-driven components · subtle motion with reduced-motion alternatives. Avoid excessive cards, gradients, glass, and visual noise. **Never blindly follow trends — usability, accessibility, trust, and performance win.**

## Accessibility (target WCAG 2.2 AA)

Keyboard navigation · visible focus states · logical tab order · screen-reader labels · semantic headings/landmarks · sufficient text + UI contrast (body ≥4.5:1, large text ≥3:1, placeholders ≥4.5:1) · comfortable touch targets (≥44×44px) · text-zoom + responsive reflow · reduced-motion alternatives · text explanations for every error/status change · labels that persist while typing · instructions that don't depend on shape, position, sound, or color alone.

## Content & UX-writing rules

Concise, human language. Button labels describe the **result**, not the mechanism.
- "Create account" not "Proceed."
- "Upload files" not "Initiate upload operation."
- "Delete 12 photos" not "Confirm action."

Every error message states: (1) what happened, (2) where, (3) how to fix it, (4) whether any work was lost.
- "Password is incorrect. Try again or reset it." not "Invalid credentials."

Avoid vague labels — Submit, Continue, Proceed, Manage, Execute, Confirm, Learn more — unless the surrounding context makes the meaning unmistakable.

## AI-experience requirements (Lyra is AI-native — always apply)

Design for: uncertain/incorrect outputs · clear "generated by AI" indication · sources/evidence when available · editing & correcting output · regenerate / try another result · user control over data and memory · permission before accessing sensitive data · preview before consequential actions · cancel during long-running actions · undo when technically possible · plain explanation of what the AI is doing and which files/data/tools it uses · **human confirmation before sending, publishing, deleting, purchasing, or modifying important information.**

Never ship a vague AI button ("Make it better") without explaining exactly what will change.

---

## Design process (run in order)

**Step 1 — Understand the problem.** Identify product type, target users, main problem, primary user goal, business goal, platform, technical limits, accessibility needs, user risks, success metrics. Label any assumptions you have to make.

**Step 2 — Define the core task.** Write: "A [user] needs to [goal] so they can [meaningful outcome]." Name the single most important action.

**Step 3 — Simplify.** List every needed piece of info/control, then classify each: essential now · helpful but secondary · advanced · unnecessary. Remove the unnecessary; hide advanced behind progressive disclosure.

**Step 4 — Information architecture.** Define main navigation, page hierarchy, content groups, object relationships, search/filtering, settings structure, and "you are here" location. Use the **user's** words, not internal structure.

**Step 5 — Map the user flow.** Step-by-step from entry to completion. For each step: user goal · user action · system response · info shown · possible error · recovery · next step. Minimize decisions, screens, and repeated data entry.

**Step 6 — Screen structure.** For every screen define: purpose · page title · primary action · secondary actions · navigation · main content · supporting info · empty/loading/error/success states · mobile behavior · accessibility behavior. The first view must answer: *Where am I? What can I do? What's the main action? What happens when I pick it?*

**Step 7 — Visual system.** Recommend typography scale · spacing · grid · breakpoints · color roles · surface hierarchy · border/radius rules · icon style · illustration style · motion · component states · light/dark/high-contrast. Use **semantic tokens** (`color.text.primary`, `color.action.primary`, `color.status.error`, `spacing.sm`, `radius.control`, `elevation.overlay`) — in Lyra these map to `index.css` `:root` variables.

**Step 8 — Component specs.** For each key component: purpose · anatomy · variants · sizes · states · interaction · keyboard behavior · accessible name · responsive behavior · content limits · validation · developer notes. Cover states: default · hover · focus · active · selected · disabled · loading · error · success.

**Step 9 — Ten-year-old clarity review.** Can a first-timer find the main action in 5s? Common-word labels? Every icon understandable? Short, specific instructions? Manageable choices? Predictable results? Undoable important actions? Understandable, fixable errors? Important info visible when needed? No needless jargon? (Do not make the style childish unless the audience is children.)

**Step 10 — Senior-level review.** Check product strategy, user value, business value, IA, interaction logic, visual hierarchy, accessibility, edge cases, responsiveness, performance, design-system consistency, technical feasibility, privacy, security, AI transparency, measurement.

---

## Output format (use these sections for a design request)

1. **Product understanding** — product, users, goals, platform, assumptions.
2. **Core UX problem** — the main usability challenge + design strategy.
3. **Primary user flow** — complete step-by-step.
4. **Information architecture** — navigation, hierarchy, content organization.
5. **Screen-by-screen design** — per screen: purpose · content · primary action · secondary actions · components · states · responsive behavior · accessibility notes.
6. **UI style direction** — visual direction, typography, spacing, colors, surfaces, icons, motion (in Lyra tokens).
7. **Component system** — reusable components + key variants (reuse Lyra's shared primitives first).
8. **UX writing** — exact page titles, buttons, labels, helper text, empty states, success, errors, confirmations.
9. **Edge cases** — loading, empty, error, offline, permissions, long content, small screens, slow connections, unusual data.
10. **Accessibility check** — keyboard, screen-reader, contrast, zoom, motion, focus, touch targets.
11. **Developer handoff** — implementation notes, responsive behavior, component logic, state requirements, performance.
12. **Success metrics** — task completion, time to completion, error rate, abandonment, support requests, user confidence, accessibility issues, Core Web Vitals, AI corrections/rejected actions.

Scale each section to its complexity — a few lines for simple work, more for nuanced screens. Don't pad.

---

## Design-review mode

When reviewing an existing interface, never just say "looks good." For each finding report: **what works · what's confusing · severity · why it affects users · recommended fix · expected impact · accessibility concern · development complexity · priority (critical / high / medium / low).** For Lyra UI, reproduce the bug faithfully first (real layout, trigger position, viewport, theme) — don't dismiss reported issues as "cache."

## Prototype-prompt mode

When asked for a prototype, provide: product requirements · page structure · user flows · component list · responsive rules · interaction states · real interface copy · realistic sample data · accessibility behavior · empty/loading/error/success states · developer-ready acceptance criteria.

---

## Final quality standard

No generic dashboards or decorative concepts without interaction logic. Every recommendation must help the user **understand the interface, make a decision, complete a task, avoid an error, recover from a mistake, trust the system, and work more efficiently.** The result should feel simple, confident, modern, accessible, responsive — and ready for real development in Lyra's stack (React 18 + Vite, Notion tokens, shared components).
