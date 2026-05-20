# Product

## Register

product

## Users

Fantasy Kingdom serves dynasty fantasy football managers in several modes:

- **Active GMs** evaluating trades and roster moves during live negotiations or deadline pressure.
- **Research-mode GMs** browsing rankings and player values without an immediate deal.
- **First-time visitors** arriving cold from a link or group chat who need orientation in seconds before using a tool.
- **League mates** shared into the site who may not be daily power users but still need to trust what they see.

Shared context: they are making roster decisions, not browsing for entertainment. The interface should stay out of the way of the task.

## Product Purpose

Fantasy Kingdom is a dynasty-focused playground for trade evaluation and player-value research, with Sleeper-backed data and an nflverse-informed trade model.

**Primary success:** trusted trade decisions; a fairness read and clear methodology people reuse in real league conversations.

**Secondary success:** a habitual dynasty hub (rankings today; leagues, sync, and more tools later) without becoming a generic fantasy portal.

## Brand Personality

**Clear, analytical, trustworthy.**

Voice is concise and confident: explain methodology when it affects trust; avoid hype and gamified chrome. A small touch of familiar fantasy-native energy (Sleeper-adjacent clarity, not sportsbook neon) is acceptable when it supports the task.

## Anti-references

Avoid:

- Generic SaaS marketing patterns: equal icon-card grids, hero metric templates, gradient text accents, modal-first onboarding.
- Cluttered legacy fantasy portals: ad-density, muddy hierarchy, everything competing for attention.
- AI dashboard slop: decorative glass stacks, side-stripe accent cards, motion without state meaning.

Not a full anti-reference: restrained sportsbook/fantasy urgency in small doses when it aids clarity, not decoration.

## Design Principles

1. **Trust through transparency** — Show how trade values are built; do not imply official Sleeper or market prices when outputs are model-derived.
2. **Task-first hierarchy** — Trade evaluation leads; rankings and future league tools support the hub without equal hero weight on the same screen.
3. **Earned familiarity** — Patterns should feel fluent to users of strong category tools (Sleeper, Linear, Raycast-class clarity), not strange for novelty.
4. **Editorial restraint** — Typography and spacing carry hierarchy before panels and glass; semantic color for state, not decoration.
5. **Inclusive by default** — AAA contrast (7:1) where feasible on dark surfaces; AA floor everywhere else; keyboard-first, visible focus, reduced motion; high-contrast toggles planned.

## Accessibility & Inclusion

- **Baseline:** WCAG 2.2 AA minimum across interactive UI.
- **Stretch:** AAA contrast (7:1 or higher) for primary text and essential controls where the dark theme allows.
- **Accommodations:** Keyboard-first navigation, visible focus rings, `prefers-reduced-motion` respected, 44px+ touch targets, semantic HTML before ARIA.
- **Planned:** User-toggle high contrast on dark surfaces; data views (trade totals, rankings) must not rely on color alone for state.
