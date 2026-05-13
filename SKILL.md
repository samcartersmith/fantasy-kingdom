---
name: dashboard
description: Dark-themed cloud-platform aesthetic with modular grids, glass-like panels, and strong data hierarchy for productivity dashboards.
license: MIT
metadata:
  author: typeui.sh
---

<!-- TYPEUI_SH_MANAGED_START -->
# Dashboard Design System Skill (Universal)

## Mission
You are an expert design-system guideline author for Dashboard.
Create practical, implementation-ready guidance that can be directly used by engineers and designers.

## Brand
Dashboard design emphasizes grids, modular components, and strong visual hierarchy to present complex data in a clear and accessible way. The interface is built for productivity, enabling users to monitor, analyze, and interact with information efficiently.

## Style Foundations
- Visual style: modern, clean, cloud-platform aesthetic (Heroku/Vercel/GitHub inspired), dark theme, subtle gradients, soft shadows, glass-like panels, rounded components
- Typography scale: 12/14/16/20/24/32 | Fonts: primary=IBM Plex Sans, display=IBM Plex Sans, mono=IBM Plex Sans | weights=100, 200, 300, 400, 500, 600, 700, 800, 900
- Color palette: primary, neutral, success, warning, danger | Tokens: primary=#0C5CAB, secondary=#0a4a8a, success=#10b981, warning=#f59e0b, danger=#ef4444, surface=#09090b, text=#fafafa
- Spacing scale: 8pt baseline grid


## Accessibility
WCAG 2.2 AA, keyboard-first interactions, visible focus states, semantic HTML before ARIA, screen-reader tested labels, reduced-motion support, 44px+ touch targets, high-contrast support

## Writing Tone
concise, confident, helpful, clear, friendly, professional, action-oriented, low-jargon

## Rules: Do
- prefer semantic tokens over raw values
- preserve visual hierarchy
- keep interaction states explicit
- design for empty/loading/error states
- ensure responsive behavior by default
- document accessibility rationale

## Rules: Don't
- avoid low contrast text
- avoid inconsistent spacing rhythm
- avoid decorative motion without purpose
- avoid ambiguous labels
- avoid mixing multiple visual metaphors
- avoid inaccessible hit areas

## Expected Behavior
- Follow the foundations first, then component consistency.
- When uncertain, prioritize accessibility and clarity over novelty.
- Provide concrete defaults and explain trade-offs when alternatives are possible.
- Keep guidance opinionated, concise, and implementation-focused.

## Guideline Authoring Workflow
1. Restate the design intent in one sentence before proposing rules.
2. Define tokens and foundational constraints before component-level guidance.
3. Specify component anatomy, states, variants, and interaction behavior.
4. Include accessibility acceptance criteria and content-writing expectations.
5. Add anti-patterns and migration notes for existing inconsistent UI.
6. End with a QA checklist that can be executed in code review.

## Required Output Structure
When generating design-system guidance, use this structure:
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Define required states: default, hover, focus-visible, active, disabled, loading, error (as relevant).
- Describe interaction behavior for keyboard, pointer, and touch.
- State spacing, typography, and color-token usage explicitly.
- Include responsive behavior and edge cases (long labels, empty states, overflow).

## Quality Gates
- No rule should depend on ambiguous adjectives alone; anchor each rule to a token, threshold, or example.
- Every accessibility statement must be testable in implementation.
- Prefer system consistency over one-off local optimizations.
- Flag conflicts between aesthetics and accessibility, then prioritize accessibility.

## Example Constraint Language
- Use "must" for non-negotiable rules and "should" for recommendations.
- Pair every do-rule with at least one concrete don't-example.
- If introducing a new pattern, include migration guidance for existing components.

<!-- TYPEUI_SH_MANAGED_END -->

## Fantasy Kingdom (project implementation)

This section extends the Dashboard skill for **this repo only**. Do not edit the TypeUI-managed block above when updating universal copy.

### Tokens ([`src/app/globals.css`](src/app/globals.css))

- **`--dash-border`**: `rgba(255, 255, 255, 0.45)` — the **strong** rim for **`.dash-glass-panel`** and nested roster tiles. Exposed in Tailwind as **`border-dash-border`** / **`divide-dash-border`**. Plain form controls in trade often use **`border-white/10`** or **`border-white/15`** instead (see Structural borders).
- **`--dash-ring`**: optional semantic ring color for Tailwind via `--color-dash-ring` in `@theme inline` (use `ring-dash-ring` when aligning focus/utility rings with tokens).
- **`--dash-glass`**: panel fill; keep hierarchy: surface, then glass fill, then border.

### Structural borders

- **Glass panels** (`.dash-glass-panel`): use **`border-dash-border`** / `var(--dash-border)` (`rgba(255, 255, 255, 0.45)`) — this is the strong outer rim for dashboard cards.
- **Softer controls inside trade** (so they don’t compete with the panel edge): **native `<select>`** (`.dash-trade-select` + Tailwind **`border-white/15`**), **text search inputs**, **catalog suggestion `<ul>`** (container **`border-white/10`**, row dividers **`divide-white/10`**), the **TotalsSummary** share bar (**`border-white/10`**), and **Clear both sides** (**`border-white/15`**) use lower-opacity whites instead of `border-dash-border`.
- **Team roster rows** in [`TeamSide`](src/components/trade/TeamSide.tsx) stay on **`border-dash-border`** so each line item still reads as a nested tile against the glass card.
- For **internal row dividers** in the soft suggestion lists, use **`divide-white/10`** (not `divide-dash-border`).
- **Exceptions**: semantic accents (`border-dash-danger/30`, `border-dash-secondary/60`), loading spinners, intentional hero sections.

### Glass panels

- Prefer **one** edge treatment: `.dash-glass-panel` already sets `border: 1px solid var(--dash-border)`. Avoid stacking faint `ring-white/[0.06]` on the same node unless there is a deliberate double-rim design.
- Accent rings (e.g. comparison `ring-dash-primary/25`, error `ring-dash-danger`) are intentional exceptions.

### Interaction and motion

- **Primary actions** (e.g. trade "Add to team", ranking tabs, primary `Link` buttons): use `cursor-pointer`, `motion-safe:transition` + `motion-safe:duration-150`, and `motion-safe:active:scale-[0.97]` (or similar) for press feedback.
- **`prefers-reduced-motion`**: global rules shorten transitions/animations; do not rely on looping decorative motion. Purposeful feedback (e.g. one-shot add highlight) should still allow **`aria-live="polite"`** announcements.
- Keep **focus-visible** rings on interactive controls (outline/focus ring patterns unchanged).

### Trade calculator ([`src/components/trade/TradeCalculator.tsx`](src/components/trade/TradeCalculator.tsx), [`src/components/trade/TeamSide.tsx`](src/components/trade/TeamSide.tsx))

- **Per-team card**: each `TeamSide` receives the full **`catalog`** plus **`onAddAsset`**; a **search field and suggestions** live in the card (typed query uses [`filterTradeCatalogSuggestions`](src/lib/trade-catalog-filter.ts) with `includeEmptyQueryDefaults: false`; empty query shows no rows). **Roster rows render above the search**; **Subtotal** stays in the header when the side is non-empty.
- **Global catalog block** below the grid still offers “Add to team 1 / 2” for the same catalog.
- **Main catalog panel**: **Tabs** (`Picks`, `QB`, `RB`, `WR`, `TE`) sit above the search; the active tab **scopes** assets (picks only, or players whose `position` string includes that skill via [`catalogPlayerHasSkillPosition`](src/lib/trade-types.ts)), then [`filterTradeCatalogSuggestions`](src/lib/trade-catalog-filter.ts) applies the search query on that subset. Tab buttons mirror the [`RankingsExplorer`](src/components/rankings/RankingsExplorer.tsx) pattern (`role="tablist"` / `role="tab"`, selected `bg-dash-primary`).
- **Add to team**: increments a per-side `flashTick` passed to `TeamSide`; the panel runs the **`dash-animate-team-flash`** class (keyframes `dash-team-flash` in globals) under `prefers-reduced-motion: no-preference`.
- **Screen readers**: hidden live region announces `Added {name} to Team {n}.` on each add (`aria-live="polite"`, `aria-atomic="true"`).
- **Borders in trade UI**: **Card shells** use the glass panel token (**`border-dash-border`**). **Selects**, **search fields**, **suggestion dropdown lists** (border + **`divide-white/10`**), the **comparison value bar**, and **Clear** use **softer** `border-white/10` / **`border-white/15`** as documented above. **Roster `<li>`** tiles use **`border-dash-border`**.

### QA (code review)

- Glass **panel** borders use **`border-dash-border`**; softer trade controls (select, search, suggestion lists, value bar, Clear) use **`border-white/10|15`** as in the skill — roster lines stay **`border-dash-border`**.
- No accidental double-faint rings on `dash-glass-panel`.
- Buttons show pointer + press affordance; reduced-motion users still get live text for trade adds.
- Focus states remain visible on keyboard nav.
