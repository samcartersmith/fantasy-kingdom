# Keyboard Accessibility Reference

## Foundational Rules

1. **Every interactive element must be keyboard reachable and operable** — if you can click it, you must be able to Tab to it and activate it with Enter/Space.
2. **Never remove focus from the page without managing it** — when content opens, moves, or closes, move focus deliberately.
3. **Preserve logical tab order** — follow the visual reading order; avoid `tabindex` values > 0.

---

## tabindex

| Value | When to use |
|---|---|
| `tabindex="0"` | Make a non-interactive element focusable (rare — prefer semantic HTML) |
| `tabindex="-1"` | Make focusable via JS (`.focus()`) but not in tab order — used for managed focus |
| `tabindex="1+"` | **Almost never.** Breaks natural order. Only for very specific edge cases. |

---

## Focus Management Patterns

### Modals / Dialogs
When a modal opens:
1. Move focus to the first focusable element inside, or to the dialog itself (`dialog[aria-labelledby]`)
2. Trap focus within the modal (Tab cycles inside; nothing outside is reachable)
3. When closed, return focus to the trigger element

```js
// Simple focus trap
function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
```

Or use the native `<dialog>` element — it handles focus trapping automatically in modern browsers.

### Drawers / Sidepanels
Same pattern as modals. If the drawer is a navigation panel, it typically should trap focus.

### Dynamic Content (toasts, alerts, inline errors)
Don't move focus to transient content — use `aria-live` regions instead (see `aria.md`).

### Route changes (SPAs)
On navigation, move focus to the `<h1>` or a `<main>` landmark:
```js
// After route change
document.querySelector('h1')?.focus(); // requires tabindex="-1" on h1
// or
document.querySelector('[role="main"], main')?.focus();
```

---

## Skip Navigation

Add a skip link as the first element in `<body>` so keyboard users can bypass repetitive nav:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Visible only on focus: -->
<style>
.skip-link {
  position: absolute;
  transform: translateY(-100%);
  transition: transform 0.2s;
}
.skip-link:focus {
  transform: translateY(0);
}
</style>

<main id="main-content" tabindex="-1">...</main>
```

---

## Component Keyboard Patterns

These are the ARIA Authoring Practices Guide (APG) patterns. Follow them — screen readers and power users expect these behaviors.

### Button
- `Enter` or `Space` → activate
- Use `<button>`, not `<div>` or `<span>`

### Link
- `Enter` → activate
- Use `<a href="...">` for navigation; `<button>` for actions

### Checkbox
- `Space` → toggle
- Use `<input type="checkbox">`

### Dropdown / Select
- For native: `<select>` handles everything
- For custom: `Space`/`Enter` opens; `↑`/`↓` moves; `Enter` selects; `Escape` closes

### Tabs (Tab widget, not Tab key)
- Tab key moves focus into and out of the tab list as a single stop
- `←`/`→` arrows move between tabs (and activate them in auto-activation mode)
- `Home`/`End` go to first/last tab

```html
<div role="tablist" aria-label="Settings sections">
  <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">Profile</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2" tabindex="-1">Security</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">...</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>...</div>
```

Only the selected tab is in the tab order (`tabindex="0"`); others get `tabindex="-1"`.

### Menu / Dropdown Menu
- `↑`/`↓` navigate items
- `Enter` activates item
- `Escape` closes and returns focus to trigger
- Letter keys move to first item starting with that letter (type-ahead)

### Combobox / Autocomplete
- Typing filters the listbox
- `↓` opens and moves into list
- `Enter` selects
- `Escape` dismisses without selecting

### Disclosure / Accordion
- `Enter` or `Space` toggles the panel open/closed
- Focus stays on the trigger button — don't move it into the panel

### Date Picker
- Follow the APG date picker pattern: arrow keys navigate days, Page Up/Down change month, Home/End go to week start/end

---

## Interactive Element Checklist

Before shipping a component, verify:

- [ ] All interactive elements reachable by Tab
- [ ] Visible focus indicator present on every focused element
- [ ] Enter/Space activates buttons; Enter activates links
- [ ] No keyboard traps (except intentional modal traps)
- [ ] Focus is managed when content opens/closes/moves
- [ ] Custom widgets follow APG keyboard patterns
- [ ] Skip nav link present on page
- [ ] Tab order matches visual reading order
