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

- **`--dash-border`**: 1px border on `.dash-glass-panel`; stronger edge on the dark surface (currently higher white alpha than the legacy 0.1 default).
- **`--dash-ring`**: optional semantic ring color for Tailwind via `--color-dash-ring` in `@theme inline` (use `ring-dash-ring` / `border-dash-border` when aligning utilities with panels).
- **`--dash-glass`**: panel fill; keep hierarchy: surface, then glass fill, then border.

### Glass panels

- Prefer **one** edge treatment: `.dash-glass-panel` already sets `border: 1px solid var(--dash-border)`. Avoid stacking faint `ring-white/[0.06]` on the same node unless there is a deliberate double-rim design.
- Accent rings (e.g. comparison `ring-dash-primary/25`, error `ring-dash-danger`) are intentional exceptions.

### Interaction and motion

- **Primary actions** (e.g. trade "Add to team", ranking tabs, primary `Link` buttons): use `cursor-pointer`, `motion-safe:transition` + `motion-safe:duration-150`, and `motion-safe:active:scale-[0.97]` (or similar) for press feedback.
- **`prefers-reduced-motion`**: global rules shorten transitions/animations; do not rely on looping decorative motion. Purposeful feedback (e.g. one-shot add highlight) should still allow **`aria-live="polite"`** announcements.
- Keep **focus-visible** rings on interactive controls (outline/focus ring patterns unchanged).

### Trade calculator ([`src/components/trade/TradeCalculator.tsx`](src/components/trade/TradeCalculator.tsx), [`src/components/trade/TeamSide.tsx`](src/components/trade/TeamSide.tsx))

- **Add to team**: increments a per-side `flashTick` passed to `TeamSide`; the panel runs the **`dash-animate-team-flash`** class (keyframes `dash-team-flash` in globals) under `prefers-reduced-motion: no-preference`.
- **Screen readers**: hidden live region announces `Added {name} to Team {n}.` on each add (`aria-live="polite"`, `aria-atomic="true"`).

### QA (code review)

- Panel borders use the token; no accidental double-faint rings on `dash-glass-panel`.
- Buttons show pointer + press affordance; reduced-motion users still get live text for trade adds.
- Focus states remain visible on keyboard nav.
