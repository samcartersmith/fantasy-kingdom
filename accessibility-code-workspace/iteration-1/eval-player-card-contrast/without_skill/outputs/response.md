# Accessibility Issues: Player Cards

## Issue 1: Green Highlighted Projected Points (Color Contrast)

### What to Check

The WCAG 2.1 standard requires a minimum contrast ratio of **4.5:1** for normal text and **3:1** for large text (18pt/14pt bold or larger) against its background.

Green text or green backgrounds are among the most common contrast failures because many "nice looking" greens — especially bright or medium greens — fall far short of these ratios.

**Specific checks to run:**

1. **Identify your exact colors.** Get the hex values for both the text color and the background color of the highlighted projected points element. If you're using something like `color: green` or `background-color: #00ff00`, those are almost certainly going to fail.

2. **Test the contrast ratio.** Use one of these tools:
   - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
   - browser DevTools (Chrome and Firefox both have contrast ratio displays in the color picker within the Accessibility panel)
   - the `axe` browser extension

3. **Determine which threshold applies.** If the projected points text is small (under ~18px regular or ~14px bold), you need 4.5:1. If it's large, 3:1.

### Common Green Contrast Problems and Fixes

| Scenario | Problem | Fix |
|---|---|---|
| Green text on white background | Bright/medium greens like `#00cc00` often fail at 4.5:1 | Use a dark green like `#1a7a1a` or `#155724` |
| White text on green background | Light/medium greens don't give enough contrast for white text | Use a dark green (e.g., `#155724`) or switch to dark text on light green |
| Green text on a colored card background | Non-white backgrounds change the math entirely | Re-test with the actual card background color |

**Recommended approach:** Dark text on a light green background typically passes more easily. For example, dark gray `#212529` on light green `#d4edda` achieves well over 7:1 contrast.

If you want to keep a "green highlight" feel:
- Light green background (`#d4edda` or similar) + dark text (`#155724` or `#212529`) — this is the Bootstrap "success alert" pattern and it passes WCAG AA.
- Avoid: bright green text (`#00cc00`, `#28a745`) on white unless you've confirmed the ratio passes.

---

## Issue 2: Injury Status Color Dots (Color as the Only Indicator)

This is a separate and equally important accessibility issue. Using only color to convey meaning violates **WCAG 1.4.1: Use of Color** (Level A — the baseline, not even AA).

### Why It Fails

Users who are colorblind (roughly 8% of men, 0.5% of women) may not be able to distinguish red from green, or may see yellow and green as identical. A colored dot with no text, icon shape, pattern, or tooltip conveys zero information to these users.

### What to Check

Ask yourself: if someone converts your UI to grayscale, can they still tell the difference between a healthy player, a questionable player, and an injured player? If not, you have a failure.

### How to Fix It

You need at least one non-color channel to communicate the status. Here are your options, roughly in order of user experience quality:

**Option 1: Add a text label (most accessible)**
```html
<!-- Instead of just a colored dot, add visible text -->
<span class="injury-dot injury-green" aria-hidden="true"></span>
<span class="injury-label">Healthy</span>

<span class="injury-dot injury-yellow" aria-hidden="true"></span>
<span class="injury-label">Questionable</span>

<span class="injury-dot injury-red" aria-hidden="true"></span>
<span class="injury-label">Out</span>
```

**Option 2: Add an `aria-label` to the dot (screen reader accessible, but still fails for colorblind sighted users)**
```html
<!-- This helps screen reader users but does NOT fix the colorblind issue -->
<span class="injury-dot injury-green" role="img" aria-label="Injury status: Healthy"></span>
```
Use this in addition to a visible indicator, not instead of one.

**Option 3: Use different shapes or icons in addition to color**
```html
<!-- Checkmark for healthy, exclamation for questionable, X for out -->
<span class="injury-indicator" aria-label="Healthy">
  <svg aria-hidden="true"><!-- checkmark icon --></svg>
</span>
```

**Option 4: Add a tooltip that appears on hover/focus**
This helps sighted users but does not fully satisfy WCAG because it requires interaction to discover. Pair it with a visible label or icon difference.

### Recommended Combined Approach

```html
<div class="injury-status">
  <span class="dot dot--healthy" aria-hidden="true"></span>
  <span class="injury-label">Healthy</span>
</div>
```

And for screen readers, if the label is already visible, no additional aria is needed. If you hide the label visually (e.g., with a `.sr-only` class), use `aria-label` on a wrapper:

```html
<div class="injury-status" role="img" aria-label="Injury status: Questionable">
  <span class="dot dot--questionable" aria-hidden="true"></span>
  <!-- Optional: visually hidden text for screen readers if no visible label -->
  <span class="sr-only">Questionable</span>
</div>
```

---

## Summary Checklist

| Issue | WCAG Criterion | Priority | Fix |
|---|---|---|---|
| Green highlight contrast ratio | 1.4.3 Contrast (Minimum) — Level AA | High | Test actual hex values; switch to dark text on light green background |
| Injury dots — color only | 1.4.1 Use of Color — Level A | Critical (Level A failure) | Add visible text labels or distinguishing icons alongside color |
| Injury dots — no accessible name | 4.1.2 Name, Role, Value — Level A | High | Add `aria-label` or visible text so screen reader users get status |

**Level A failures (like the color-only dots) should be treated as blockers** — they exclude users at the most basic level of WCAG conformance.

---

## Practical Next Steps

1. Run your card through the axe DevTools extension — it will flag missing text alternatives and contrast failures automatically.
2. Use Chrome DevTools > Accessibility panel to inspect the contrast ratio of your green highlighted points in context.
3. Test with the "Emulate vision deficiency" option in Chrome DevTools (Rendering tab) — set it to Deuteranopia (green-blind) to see exactly what colorblind users see.
4. Add visible text labels to all three injury states as the minimum fix, then layer in `aria-label` for screen reader support.
