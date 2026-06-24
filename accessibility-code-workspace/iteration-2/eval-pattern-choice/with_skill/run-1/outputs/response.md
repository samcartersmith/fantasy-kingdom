# Pattern Choice: Team Switcher in Top Nav Bar

## Recommendation: Use a disclosure button with a plain list of links

**Do not use `role="menu"`, `<dialog>`, or `role="combobox"` for this pattern.**

---

## Why not each alternative

### `role="menu"` — Wrong semantic
`role="menu"` is for **application-style action menus** (think: right-click context menus, editor toolbar menus). It carries a specific keyboard contract that assistive technologies advertise to users:
- Arrow keys navigate items
- `Enter` activates
- `Escape` closes
- Type-ahead moves to the first matching `menuitem`

Critically, screen readers announce `menu` widgets as **"application" context**, suppressing normal reading shortcuts. Your items are **navigation links** — they take the user to a different page. Wrapping links in a `menu`/`menuitem` pattern is a semantic mismatch and will confuse screen reader users who expect menu items to perform discrete actions, not navigate.

### `<dialog>` — Wrong weight
A dialog implies a task that requires a decision and captures focus in a trap. Switching teams is a single-step navigation action, not a workflow that needs modal containment. A dialog forces the user to consciously dismiss it and adds unnecessary complexity for 3–5 simple navigation options.

### `role="combobox"` — Wrong affordance
Combobox is for filterable/autocomplete **form inputs**. It expects a text field, signals "type to search", and announces as a form control. None of that applies here — you are not collecting input, and the user does not need to type.

---

## The right pattern: Disclosure button + list of links

This matches the **Disclosure (Show/Hide) pattern** from the ARIA Authoring Practices Guide. It is the correct choice when:
- A button toggles a container of content/links visible or hidden
- The container holds navigation links, not application actions
- No complex keyboard widget behavior is needed beyond the toggle

### Implementation

```html
<nav aria-label="Team switcher">
  <button
    id="team-switcher-btn"
    aria-expanded="false"
    aria-controls="team-switcher-menu"
  >
    Roto Rooters <!-- current team name -->
  </button>

  <ul id="team-switcher-menu" hidden>
    <li><a href="/teams/1">Roto Rooters</a></li>
    <li><a href="/teams/2">Grid Irons FC</a></li>
    <li><a href="/teams/3">Fumble Force</a></li>
  </ul>
</nav>
```

```js
const btn = document.getElementById('team-switcher-btn');
const menu = document.getElementById('team-switcher-menu');

btn.addEventListener('click', () => {
  const isOpen = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!isOpen));
  menu.hidden = isOpen;
  if (!isOpen) {
    // Move focus to first link when opening
    menu.querySelector('a')?.focus();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    btn.focus(); // return focus to trigger
  }
});

// Close when focus leaves the widget entirely
menu.addEventListener('focusout', (e) => {
  if (!menu.contains(e.relatedTarget)) {
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  }
});
```

---

## What this gives you for free

| Concern | How it's covered |
|---|---|
| **Keyboard** | `<button>` is Tab-reachable and activated by `Enter`/`Space`; `<a>` links are Tab-reachable and activated by `Enter` |
| **ARIA** | `aria-expanded` communicates open/closed state; `aria-controls` associates the button with its panel |
| **Focus management** | Focus moves into list on open; `Escape` returns focus to the trigger |
| **Screen reader announcement** | Button announces as "Roto Rooters, collapsed, button" / "expanded"; links announce as navigation links |
| **No custom keyboard widget** | Users Tab through links naturally — no arrow-key override needed |

---

## What NOT to do

- **Do not** add `role="menu"` or `role="menuitem"` to the `<ul>`/`<li>`/`<a>` elements. This forces you to implement the full menu keyboard contract and mislabels navigation links as application actions.
- **Do not** use `tabindex="-1"` on the links and manage arrow-key navigation yourself — that is the menu pattern and it is wrong here.
- **Do not** use `<select>` — it is semantically a form input for selecting a value to submit, not a navigation control.

---

## Applicable WCAG criteria

- **2.1.1 Keyboard (Level A)** — all functionality operable via keyboard
- **2.4.3 Focus Order (Level A)** — focus sequence is logical (button → first link → remaining links)
- **4.1.2 Name, Role, Value (Level A)** — button has a name (team name text), role (`button`), and value (`aria-expanded`); links have names (team name text) and role (`link`)
