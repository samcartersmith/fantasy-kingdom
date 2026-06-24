# Accessibility Fixes for Player Cards

Two distinct issues here, each governed by a different WCAG criterion. I'll walk through both.

---

## Issue 1: Green projected points highlight — Color Contrast

**Criterion: WCAG 1.4.3 (Contrast Minimum, AA)**

Your designer is right to flag this. Green-on-white (or green-on-card-background) is one of the most common contrast failures. The specific requirement depends on your text size:

| Text size | Required ratio |
|---|---|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 |
| Large text (≥ 18pt or ≥ 14pt bold) | 3:1 |

Projected points are likely displayed at a normal body size, so you're targeting **4.5:1**.

### How to check

Run your exact green foreground color against your card background color through a contrast checker. Use browser DevTools color picker, or paste the hex values into [Coolors Contrast Checker](https://coolors.co/contrast-checker).

Common greens that fail:
- `#4CAF50` on white = ~4.5:1 (borderline — passes, barely)
- `#66BB6A` on white = ~3.3:1 (fails)
- `#81C784` on white = ~2.5:1 (fails)
- `#2E7D32` on white = ~9:1 (passes easily)

### What to fix

If your green fails, use a darker green for the text/number itself — you don't need to change the background color. A dark green like `#276221` or `#1B5E20` on a white or light card background will pass.

```css
/* Example: failing */
.projected-points.high {
  color: #66BB6A; /* ~3.3:1 on white — FAIL */
}

/* Fixed: darker green that passes 4.5:1 */
.projected-points.high {
  color: #1B6E1B; /* passes 4.5:1 on white */
}
```

If you're using the green as a background highlight with white text on top, that combination almost always fails — light green backgrounds need dark (near-black) text, not white.

---

## Issue 2: Colored dot for injury status — Color as the Only Cue

**Criterion: WCAG 1.4.1 (Use of Color, AA)**

A green/yellow/red dot conveys meaning through color alone. Users who are colorblind (roughly 8% of males have red-green color blindness) cannot distinguish these states. A screen reader user gets nothing at all — a dot has no accessible name and no semantic meaning.

This needs two fixes: one for low-vision/colorblind users, one for screen reader users.

### Fix 1: Add a non-color cue for sighted users

Don't rely on color alone. Add a text label or at minimum a distinct shape/icon per status.

**Option A — Text label (recommended):**
```html
<span class="injury-status injury-status--questionable">
  Q
</span>
```
Or spell it out if space allows: "Out", "Q", "GTD" — these are already standard fantasy conventions that don't depend on color perception.

**Option B — Shape/icon + color:**
Use distinct icons per status (checkmark for healthy, warning triangle for questionable, X for out) so the shape carries the meaning, not just the color.

### Fix 2: Make the status readable by screen readers

The dot is almost certainly a `<span>` or `<div>` with no text content. A screen reader skips it or reads nothing useful.

The correct fix is visually hidden text:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

```html
<!-- Before: screen reader reads nothing -->
<span class="dot dot--red" aria-hidden="false"></span>

<!-- After: screen reader reads "Injury status: Out" -->
<span class="dot dot--red" aria-hidden="true"></span>
<span class="sr-only">Injury status: Out</span>
```

Note: `aria-hidden="true"` on the dot suppresses the decorative element. The `sr-only` span carries the text. Together, sighted users see the dot, screen reader users hear the label.

Alternatively, if the dot is a standalone element with no adjacent text, use `aria-label` directly:

```html
<span
  class="dot dot--red"
  role="img"
  aria-label="Injury status: Out"
></span>
```

Use `role="img"` here because a `<span>` has no implicit role — without it, screen readers may not read the `aria-label`. The `role="img"` + `aria-label` combination makes it a labeled image.

---

## Summary of what to do

1. **Contrast check your green** — plug your exact hex values into a contrast checker. If the ratio is below 4.5:1, darken the green until it passes. Don't change the background; change the foreground text/number color.

2. **Add text to injury dots** — pick between visually-hidden `sr-only` text (if the dot stays decorative) or visible text labels. Either way, screen readers need something to announce. Colorblind users need a non-color cue too — visible abbreviations ("Out", "Q", "GTD") solve both at once.

3. **Don't touch the card background color** — the card background is not the problem. The contrast issue is specifically between the highlighted number and its background, and the injury dot conveys meaning through color alone.
