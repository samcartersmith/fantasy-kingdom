---
name: accessibility-code
description: >
  Use this skill whenever accessibility is involved in any engineering task — even peripherally.
  Triggers include: building or reviewing any UI component, fixing a screen reader bug, adding
  keyboard navigation, choosing between HTML elements, working with ARIA attributes, handling focus,
  writing accessible forms, modals, tooltips, dropdowns, tabs, or any interactive pattern. Also
  triggers when the user mentions a11y, WCAG, ADA compliance, assistive technology, color contrast,
  focus management, or "accessible". Don't wait for the user to say "make this accessible" — if
  they're building UI and haven't mentioned accessibility, raise it proactively.
---

# Accessibility Code Skill

You are helping an engineer implement accessible UI. Your job is to:
1. Identify which accessibility pillar(s) apply to the task
2. Load the relevant reference file(s) from `references/`
3. Apply the right spec — concrete patterns and code, not vague advice

## The one rule that overrides everything

**Use native HTML before ARIA.**

A `<button>` is better than `<div role="button">`. A `<nav>` is better than `<div role="navigation">`. Native elements bring keyboard behavior, roles, and states for free. Reach for ARIA only when no native element fits or you need to supplement semantics.

---

## Step 1 — Identify the pillar(s)

Read the user's request and map it to one or more of these four pillars:

| Pillar | When it applies |
|---|---|
| **Visual** | Color contrast, focus indicators, color-only cues, text sizing, motion/animation |
| **Keyboard** | Tab order, focus management, keyboard shortcuts, focus traps, component keyboard patterns |
| **ARIA** | Roles, states, properties, live regions, labeling (`aria-label`, `aria-labelledby`, etc.) |
| **AT Compatibility** | Screen reader behavior, voice control, switch access, testing across reader/browser combos |

Most tasks touch 2–3 pillars. A modal, for example, involves keyboard (focus trap), ARIA (role, labeling, aria-modal), and AT compatibility (screen reader announcement).

---

## Step 2 — Load the reference file(s)

Read only what you need:

- **Visual issues** → `references/visual.md`
- **Keyboard issues** → `references/keyboard.md`
- **ARIA questions** → `references/aria.md`
- **Screen reader / AT testing** → `references/at-compat.md`

For component work (modals, dropdowns, tabs, etc.) you'll almost always need `keyboard.md` + `aria.md` together.

---

## Step 3 — Deliver concrete guidance

After reading the relevant reference(s):

- Name the specific WCAG criterion or pattern that applies
- Show the correct implementation (code when relevant)
- Flag what NOT to do and why, when the anti-pattern is common
- If multiple valid approaches exist, explain the trade-off and recommend one

Keep the response focused. Don't dump the entire spec — answer what the engineer actually needs.
