# ARIA Reference

## The First Rule of ARIA

> **Don't use ARIA if a native HTML element or attribute provides the semantics and behavior you need.**

Before adding any `role`, `aria-*`, or `aria-label`:
1. Is there a native element that does this? (`<button>`, `<nav>`, `<dialog>`, `<details>`, `<select>`, etc.)
2. Does the native element handle the keyboard behavior automatically?
3. If yes to both — use it. No ARIA needed.

---

## Labeling: The Hierarchy

Screen readers derive an accessible name for every element. The order of precedence (highest wins):

1. `aria-labelledby` — references another element's visible text
2. `aria-label` — inline string (not visible)
3. `<label>` element (for form controls)
4. `title` attribute (tooltip; avoid relying on this)
5. Element content / alt text

**Use `aria-labelledby` when there's already visible text that describes the element:**
```html
<h2 id="roster-heading">My Roster</h2>
<section aria-labelledby="roster-heading">...</section>
```

**Use `aria-label` when there's no visible text and you can't add one:**
```html
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>
```

**Use `aria-describedby` for supplementary description (not the primary label):**
```html
<input id="email" aria-describedby="email-hint" type="email">
<p id="email-hint">We'll use this to send trade notifications.</p>
```

---

## Landmark Roles

Landmarks help screen reader users navigate page regions. Prefer semantic HTML elements:

| HTML element | Implicit role | Notes |
|---|---|---|
| `<header>` | `banner` | Top-level only; inside `<article>` it has no role |
| `<nav>` | `navigation` | Label multiple navs: `aria-label="Primary"` |
| `<main>` | `main` | One per page |
| `<footer>` | `contentinfo` | Top-level only |
| `<aside>` | `complementary` | |
| `<section>` | `region` | Only if it has an accessible name (`aria-labelledby`) |
| `<form>` | `form` | Only if it has an accessible name |
| `<search>` | `search` | HTML5.3; or use `<div role="search">` |

If you must use a `<div>`, add the role explicitly:
```html
<div role="navigation" aria-label="Breadcrumb">...</div>
```

---

## Common Roles

Only add a `role` when there's no native element that fits:

| Role | Use when |
|---|---|
| `alert` | Short, important, auto-announced message (errors, warnings) |
| `status` | Polite status update (auto-announced) |
| `dialog` | Modal overlay — prefer `<dialog>` element |
| `tooltip` | Informational popup tied to a trigger |
| `tab` / `tablist` / `tabpanel` | Tab widget |
| `menu` / `menuitem` | App-style action menus (not navigation) |
| `listbox` / `option` | Custom select/combobox |
| `combobox` | Autocomplete input |
| `tree` / `treeitem` | Hierarchical list |
| `grid` / `gridcell` | Interactive grid (not a data table) |

---

## States and Properties

Add these to keep the AT in sync with the UI state:

### Expansion / Visibility
```html
<!-- Accordion trigger -->
<button aria-expanded="false" aria-controls="panel-id">Section Title</button>

<!-- Toggleable menu -->
<button aria-expanded="true" aria-haspopup="true">Options</button>
```

### Selection
```html
<!-- Tab widget -->
<button role="tab" aria-selected="true">Profile</button>

<!-- Listbox option -->
<li role="option" aria-selected="false">Option A</li>
```

### Checked State
```html
<!-- Custom checkbox -->
<div role="checkbox" aria-checked="true" tabindex="0">Notify me</div>

<!-- Toggle button -->
<button aria-pressed="true">Bold</button>
```

### Disabled
```html
<!-- Prefer the native disabled attribute; use aria-disabled when you need the element to remain focusable -->
<button disabled>Submit</button>
<button aria-disabled="true">Submit</button> <!-- still focusable -->
```

### Invalid / Required (Forms)
```html
<input aria-required="true" aria-invalid="true" aria-describedby="error-msg">
<p id="error-msg" role="alert">Email is required.</p>
```

### Hidden from AT
```html
<!-- Decorative, redundant, or visually-only elements -->
<svg aria-hidden="true" focusable="false">...</svg>
<span aria-hidden="true">★★★★☆</span> <!-- if rating is conveyed elsewhere -->
```

---

## Live Regions

Live regions announce dynamic content to screen readers without moving focus. Use them for:
- Toast notifications
- Status updates (autosave, loading complete)
- Validation errors that appear after interaction
- Chat messages, score updates

```html
<!-- Polite: waits for user to finish current action -->
<div aria-live="polite" aria-atomic="true" class="sr-only"></div>

<!-- Assertive: interrupts immediately — use sparingly (errors, critical alerts) -->
<div aria-live="assertive" role="alert"></div>
```

**`aria-atomic="true"`** — announces the entire region's content as one string (good for status messages).  
**`aria-atomic="false"`** — announces only the changed portion (good for chat, log feeds).

**Inject content dynamically — don't use `hidden`:**
```js
// The region must already be in the DOM, then update it
const liveRegion = document.getElementById('status');
liveRegion.textContent = 'Draft saved.';
```

**Shorthand roles:**
- `role="alert"` = `aria-live="assertive"` + `aria-atomic="true"`
- `role="status"` = `aria-live="polite"` + `aria-atomic="true"`

---

## Common Component Patterns

### Modal Dialog
```html
<dialog
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">Confirm Trade</h2>
  <p id="dialog-desc">This will send a trade offer to your league mate.</p>
  <!-- content -->
  <button autofocus>Confirm</button>
  <button>Cancel</button>
</dialog>
```

### Tooltip
```html
<button aria-describedby="tip-1">
  Info
</button>
<div role="tooltip" id="tip-1">Shows player performance over 4 weeks</div>
```

### Combobox (Autocomplete)
```html
<label for="player-search">Search players</label>
<input
  id="player-search"
  role="combobox"
  aria-expanded="true"
  aria-autocomplete="list"
  aria-controls="player-listbox"
  aria-activedescendant="player-option-3"
  type="text"
>
<ul role="listbox" id="player-listbox">
  <li role="option" id="player-option-1">Justin Jefferson</li>
  <li role="option" id="player-option-2">CeeDee Lamb</li>
  <li role="option" id="player-option-3" aria-selected="true">Ja'Marr Chase</li>
</ul>
```

### Visually Hidden (Screen Reader Only) Text
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

Use this when you need to add context that's redundant visually but meaningful to a screen reader user:
```html
<button>
  Delete
  <span class="sr-only">player Davante Adams from roster</span>
</button>
```
