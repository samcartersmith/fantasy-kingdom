---
name: Fantasy Kingdom
description: Dark dynasty tool UI — analytical clarity, restrained blue accent, glass panels used sparingly
colors:
  primary: "#0c5cab"
  secondary: "#0a4a8a"
  success: "#10b981"
  warning: "#f59e0b"
  danger: "#ef4444"
  surface: "#09090b"
  surface-elevated: "#0f0f12"
  text: "#fafafa"
  border-strong: "#ffffff73"
  ring-subtle: "#ffffff24"
  glass-fill: "#ffffff0f"
typography:
  display:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.11
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.56
    letterSpacing: "-0.025em"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  link-nav:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 0"
  tab-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Fantasy Kingdom

## Overview

**Creative North Star: "The Trusted Trade Desk"**

Fantasy Kingdom looks like a focused dynasty workstation, not a marketing site or sportsbook. Surfaces are dark, data-dense where tools demand it, and editorial where orientation matters. Hierarchy comes from IBM Plex Sans scale and weight before decoration. Glass panels exist for grouping trade and rankings work, but they are not the default answer for every block.

The system explicitly rejects generic SaaS landing grids, cluttered legacy fantasy portals, and AI dashboard slop (stacked glass, side-stripe accents, decorative motion). A sliver of familiar fantasy-native urgency is allowed when it aids clarity.

**Key Characteristics:**

- Dark cloud-platform base with a cool blue primary and near-white text tuned for contrast targets in PRODUCT.md
- Restrained accent: primary blue on actions, tabs, focus, and links; semantic greens/ambers/reds for state only
- Fixed rem type scale via `.dash-heading-*` utilities on tool surfaces
- Depth through tonal surfaces and selective glass, not heavy shadow stacks
- Keyboard-first focus (`:focus-visible` primary outline), 44px targets, reduced-motion respected globally

## Colors

Palette character: cool midnight neutrals with one trustworthy blue accent and explicit semantic state colors.

### Primary

- **Workbench Blue** (`#0c5cab` / oklch(48% 0.14 250)): Primary actions, selected tabs, focus rings, skip link, key links. Rare enough to read as "go here."

### Secondary

- **Deep Rail Blue** (`#0a4a8a` / oklch(40% 0.12 250)): Hover darken on primary, secondary accents on comparison rings.

### Tertiary

- **Signal Green / Amber / Red** (`#10b981`, `#f59e0b`, `#ef4444`): Success, warning, and danger only. Never decorative fills.

### Neutral

- **Obsidian Surface** (`#09090b`): Page background; body gradient lifts through **Elevated Slate** (`#0f0f12`) mid-page.
- **Soft Snow Text** (`#fafafa`): Primary copy. Muted copy uses opacity on the same hue (`text-dash-text/55` through `/90`), not a second gray family.
- **Strong Rim** (`rgba(255,255,255,0.45)` as `--dash-border`): Glass panel and roster tile borders.
- **Soft Control Rim** (`border-white/10`, `border-white/15`): Inputs, selects, suggestion lists inside trade so controls do not fight the panel edge.
- **Glass Fill** (`rgba(255,255,255,0.06)`): `.dash-glass-panel` background with 12px blur.

### Named Rules

**The One Accent Rule.** Primary blue appears on CTAs, selected tabs, focus, and intentional links. It must not wallpaper backgrounds or body text blocks.

**The Contrast Stretch Rule.** Aim for 7:1 on essential text and controls on dark surfaces; never ship primary copy below AA. Plan a user-toggle high-contrast mode (PRODUCT.md).

## Typography

**Display Font:** IBM Plex Sans (Google font, `--font-ibm-plex-sans`)
**Body Font:** IBM Plex Sans (same stack for UI and mono labels in trade)
**Label Font:** IBM Plex Sans semibold uppercase for fairness blocks and eyebrows

**Character:** Analytical and calm. One family keeps trade tables and headings aligned; hierarchy is scale and weight, not pairing contrast.

### Hierarchy

- **Display** (700, 2.25rem / 2.5rem line, -0.025em tracking): Tool page `h1` via `.dash-heading-page` on `/trade`, `/rankings`.
- **Headline** (700, 1.875rem): Section `h2` (Comparison, catalog block, modal titles) via `.dash-heading-section`.
- **Title** (600, 1.125rem / 1.25rem sm+): Team columns and sidebar promos via `.dash-heading-subsection`.
- **Body** (400–500, 0.875rem–1rem, relaxed leading): Explanatory copy, roster lines; cap prose blocks at 65–75ch where long-form.
- **Label** (600, 0.75rem, uppercase, wide tracking): Fairness / balance labels in evaluate modal (`h4` pattern).

### Named Rules

**The Heading Utility Rule.** On trade and rankings tool surfaces, never improvise `text-3xl` on an `h2`. Use `.dash-heading-page`, `.dash-heading-section`, or `.dash-heading-subsection` with `text-dash-text`.

## Elevation

Depth is **tonal layering first**, glass second, shadow last. The page body uses a subtle radial blue glow and vertical gradient, not floating cards everywhere. `.dash-glass-panel` adds inset highlight plus `0 8px 32px rgba(0,0,0,0.35)`; modals use `shadow-xl` on elevated surface with `border-white/15`.

### Shadow Vocabulary

- **Panel lift** (`0 8px 32px rgba(0,0,0,0.35)` on glass): Default grouped tool panels.
- **Modal shell** (`shadow-xl` + `ring-1 ring-white/10`): Trade evaluation overlay.
- **State flash** (`dash-team-flash` keyframes): One-shot primary ring expansion on add-to-team; disabled under `prefers-reduced-motion`.

### Named Rules

**The Flat Control Rule.** Form controls inside glass use soft white borders, not `border-dash-border`, so the panel rim stays the strongest edge.

**The Motion Feedback Rule.** Transitions are 150ms ease-out for press and color; no layout animation. Decorative loops are forbidden.

## Components

### Buttons

- **Shape:** 8px radius (`--dash-radius-sm`), min-height 44px on primary paths.
- **Primary:** `bg-dash-primary`, `text-dash-text`, semibold 0.875rem; hover `bg-dash-primary/90`; `motion-safe:active:scale-[0.97]` on key CTAs.
- **Hover / Focus:** `focus-visible:ring-2 ring-dash-primary ring-offset-dash-surface`; pointer cursor required.
- **Ghost / text:** Header and sidebar links use `text-dash-text/90` → `hover:text-dash-primary`.

### Chips / Tabs

- **Style:** Tablist on trade catalog and rankings; selected tab `bg-dash-primary`, unselected transparent with hover brighten.
- **State:** `role="tab"` / `aria-selected`; keyboard operable.

### Cards / Containers

- **Corner Style:** 12px (`--dash-radius-md`) on panels.
- **Background:** `.dash-glass-panel` or `bg-dash-surface-elevated` in modals.
- **Shadow Strategy:** See Elevation; avoid double faint rings on glass nodes.
- **Border:** `border-dash-border` on glass shells; roster `<li>` tiles match; inner controls softer.
- **Internal Padding:** 16–24px (`p-4`–`p-6`); vary by density (trade grid tighter than home hero).

### Inputs / Fields

- **Style:** `.dash-trade-select` for native selects (custom chevron, inset padding); text inputs `border-white/15`, `bg-black/35`.
- **Focus:** Global `:focus-visible` 2px `outline` primary; components may add ring utilities.
- **Error:** Danger border/ring on comparison panel when sides invalid (`ring-dash-danger`).

### Navigation

- **Style:** Sticky top bar `border-b border-white/10`, `bg-dash-surface`, max-width 6xl shell.
- **Typography:** Site title semibold 1.125rem; nav links medium 0.875rem.
- **States:** Hover primary color; min-height 44px hit targets.

### Trade Calculator (signature)

- Two-column team cards with subsection headings, catalog tabs, live region on add, evaluate modal with share bar and fairness narrative. Wide layout adds sticky featured-links aside at `2xl`.

## Do's and Don'ts

### Do:

- **Do** use semantic `dash-*` tokens from `globals.css` instead of raw hex in components.
- **Do** pair glass panel rims (`border-dash-border`) with softer inner control borders (`white/10–15`).
- **Do** document methodology near trade values; use `text-dash-text/70` for supporting legal-style copy.
- **Do** honor `prefers-reduced-motion` and keep `aria-live` feedback on trade adds.
- **Do** target AAA contrast on primary text where feasible; encode state with icon/label plus color.

### Don't:

- **Don't** use equal icon-card grids or hero metric templates on marketing-style home sections.
- **Don't** stack decorative glass panels as the default layout pattern.
- **Don't** use `border-left` or `border-right` greater than 1px as colored accent stripes on list items or alerts.
- **Don't** use gradient text or neon sportsbook chrome for decoration.
- **Don't** open modals when inline or progressive disclosure suffices.
- **Don't** imply official Sleeper or market prices in visual emphasis; model outputs stay visually distinct from API branding.
