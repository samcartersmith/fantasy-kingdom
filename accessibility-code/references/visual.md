# Visual Accessibility Reference

## Color Contrast

**WCAG 2.1 AA minimums (the standard to target):**

| Content type | Minimum ratio |
|---|---|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 |
| Large text (≥ 18pt or ≥ 14pt bold) | 3:1 |
| UI components & graphical objects | 3:1 |
| Decorative / disabled elements | No requirement |

**WCAG AAA (stretch goal):** 7:1 for normal text, 4.5:1 for large text.

Check contrast with: browser DevTools color picker, [Coolors Contrast Checker](https://coolors.co/contrast-checker), or the `color-contrast()` CSS function (modern browsers).

**Common pitfalls:**
- Placeholder text in inputs often fails — style it separately from actual input values
- Disabled states have no requirement but should still be perceivable; very low contrast + no other affordance is bad UX
- Hover/focus state overlays (e.g., a white overlay on a colored button) must meet the 3:1 UI component ratio against what's behind them

---

## Don't Rely on Color Alone

WCAG 1.4.1: Color must not be the only visual means of conveying information.

**Examples of what to fix:**

| ❌ Color only | ✅ Color + another cue |
|---|---|
| Red border on invalid input | Red border + error icon + error message text |
| Green dot for "online" status | Green dot + "Online" label (or tooltip) |
| Blue = required field | Asterisk (*) + "required" text in legend |
| Chart line colors | Line colors + distinct patterns or labels |

---

## Focus Indicators

WCAG 2.4.11 (AA, WCAG 2.2): Focus indicators must be visible and meet a minimum size + contrast.

**The spec:**
- Focus indicator area ≥ the perimeter of the component × 2px
- Contrast ratio ≥ 3:1 between focused and unfocused states

**In practice, use this:**
```css
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Or a high-contrast approach: */
:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 3px;
  border-radius: 2px;
}
```

**Never do this:**
```css
:focus { outline: none; } /* kills keyboard navigation */
```

If you must remove the default outline (e.g., for design), replace it — don't just delete it.

Use `:focus-visible` (not `:focus`) so the indicator appears for keyboard users but not mouse clicks.

---

## Text Sizing & Zoom

WCAG 1.4.4: Text must be resizable up to 200% without loss of content or functionality.
WCAG 1.4.10: Content must reflow at 320px wide without horizontal scrolling (for vertical scrolling content).

**What this means in practice:**
- Use `rem`/`em` for font sizes — not `px`. Base font: 16px = 1rem.
- Avoid fixed-height containers that clip text when zoomed
- Test at 200% browser zoom — does anything break?
- Don't use `user-scalable=no` in your viewport meta tag

```html
<!-- ❌ Prevents zoom on mobile -->
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">

<!-- ✅ -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```

---

## Motion & Animation

WCAG 2.3.3 (AAA) / best practice (AA): Respect `prefers-reduced-motion`.

Users with vestibular disorders can be harmed by excessive animation. Always:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Or per-component:
```css
.spinner {
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    /* Substitute a static loading indicator */
  }
}
```

Auto-playing video/audio with motion: provide a pause/stop control (WCAG 2.2.2).

---

## Images & Icons

- Informative images: `alt="descriptive text"`
- Decorative images: `alt=""` (empty, not missing)
- Functional images (e.g., icon button): describe the function, not the image — `alt="Close dialog"`
- SVG icons inline: use `aria-hidden="true"` if the parent button/link has its own label; otherwise add `<title>` or `aria-label`

```html
<!-- Icon button — label on the button, not the SVG -->
<button aria-label="Close dialog">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>

<!-- Standalone informative SVG -->
<svg role="img" aria-labelledby="chart-title">
  <title id="chart-title">Revenue by quarter, 2025</title>
  ...
</svg>
```
