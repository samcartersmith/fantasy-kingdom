# Assistive Technology Compatibility Reference

## The Screen Reader / Browser Matrix

Different screen readers behave differently with the same HTML. Target these combinations (industry standard):

| Priority | Screen Reader | Browser | Platform |
|---|---|---|---|
| **High** | NVDA | Chrome | Windows |
| **High** | VoiceOver | Safari | macOS / iOS |
| **High** | TalkBack | Chrome | Android |
| **Medium** | JAWS | Chrome or Edge | Windows |
| **Low** | Narrator | Edge | Windows |

**When in doubt, test NVDA+Chrome and VoiceOver+Safari.** Together they cover the majority of screen reader users.

---

## How Screen Readers Read the Page

Screen readers build a virtual buffer of the page — they don't read the visual layout, they read the accessibility tree (DOM + ARIA). Key implications:

- **Order matters.** Screen readers traverse in DOM order, not visual order. CSS `order` and `flex`/`grid` visual reordering doesn't change the reading order.
- **Non-semantic elements are invisible.** A `<div>` with text is just text — no role, no interaction hint.
- **Dynamic content isn't automatically announced.** Only `aria-live` regions and focus movement trigger announcements for dynamic changes.
- **Hidden elements are skipped.** `display: none`, `visibility: hidden`, and `hidden` attribute all hide content from AT. `opacity: 0` does NOT hide from AT.

---

## Screen Reader Quirks by Reader

### NVDA (Windows + Chrome)
- Best HTML5 + ARIA support overall
- Browse mode (reading) vs. Forms mode (input) — auto-switches; can confuse users if you mix interactive + non-interactive elements unexpectedly
- `aria-live` announcements generally reliable
- Test custom widgets here first

### VoiceOver (macOS + Safari)
- Excellent native HTML support; ARIA support is solid but has gaps
- Rotor (VO+U) lets users navigate by landmarks, headings, links, form controls — these must be present and labeled
- Touch navigation on iOS differs significantly from desktop cursor navigation
- `role="dialog"` + `aria-modal="true"` required for proper modal behavior
- Known gap: some `aria-live` updates can be delayed or skipped

### TalkBack (Android + Chrome)
- Touch-first: swipe to navigate, double-tap to activate
- Linear navigation through the accessibility tree
- Test that all interactive elements have sufficient touch target size (≥ 44×44px)
- `aria-live` support is good in modern versions

### JAWS (Windows + Chrome/Edge)
- Most widely used among professional/enterprise users
- Virtual cursor behavior similar to NVDA
- Generally strong ARIA support
- Can be more forgiving of ARIA errors than NVDA

---

## Voice Control

### Dragon NaturallySpeaking (Windows) / Voice Control (macOS, iOS)
Users say element names to interact ("click Submit", "tap Search").

**What breaks voice control:**
- Buttons or links with no visible text label (icon-only without visible text)
- `aria-label` that doesn't match visible text — user says what they see, not the ARIA label

**Fix:** When using `aria-label`, make sure it starts with the visible text:
```html
<!-- ❌ User sees "★" but has to say "Favorite player" -->
<button aria-label="Favorite player">★</button>

<!-- ✅ Start aria-label with the visible text, or add visible text -->
<button>
  <span aria-hidden="true">★</span>
  <span class="sr-only">Favorite</span>
</button>
```

This is especially important for icon buttons.

---

## Switch Access

Users with motor impairments navigate with 1–2 switches (buttons), cycling through focusable elements.

**Requirements:**
- Every interactive element must be in the tab order
- Tab order must be logical — switches cycle through in order
- No time-limited interactions (or provide time extensions)
- Large enough touch/click targets

---

## Testing Checklist

### Quick Smoke Test (do this before every PR)
- [ ] Tab through the entire page — can you reach and operate everything?
- [ ] Check focus indicators are visible on every interactive element
- [ ] Turn on VoiceOver (macOS: Cmd+F5) — read through the component
- [ ] Turn on NVDA — navigate with arrow keys through the content

### Screen Reader Test Procedure
1. Open the page with the screen reader active
2. Navigate via headings (H key in NVDA/JAWS, VO+Cmd+H in VoiceOver) — is the heading structure logical?
3. Navigate via landmarks (D in NVDA/JAWS, VO+U > Landmarks in VoiceOver) — are all regions labeled?
4. Navigate via form controls — are all inputs labeled? Are errors announced?
5. Activate each interactive component (modal, dropdown, tabs) — is behavior correct?
6. Check dynamic content — are updates announced via live regions?

### Automated Tools (Catch ~30-40% of issues)
- **axe DevTools** (browser extension) — most accurate automated scanner
- **Lighthouse Accessibility audit** (built into Chrome DevTools)
- **eslint-plugin-jsx-a11y** (for React codebases) — catches issues at write-time

Automated tools are a floor, not a ceiling. They can't test keyboard patterns, focus management, or screen reader announcements.

---

## Common AT Failure Patterns

| Symptom | Likely cause | Fix |
|---|---|---|
| Screen reader says "button" with no context | Icon button, no label | Add `aria-label` or visible label |
| Announcements happen twice | `aria-label` + visible text both read | Make them match, or use `aria-labelledby` |
| Modal doesn't trap focus | Missing focus trap logic | Implement trap or use `<dialog>` |
| Dynamic error not announced | No `aria-live` region | Add `role="alert"` or `aria-live="assertive"` |
| Tab order jumps around | `tabindex > 0` or mismatched DOM/visual order | Remove positive tabindex values |
| Screen reader can't find nav | `<div class="nav">` without landmark | Use `<nav>` or `role="navigation"` |
| Custom dropdown inaccessible | Not following listbox/combobox pattern | Implement APG combobox pattern + ARIA states |
| Links read as "click here" | Generic link text | Make link text descriptive of the destination |
