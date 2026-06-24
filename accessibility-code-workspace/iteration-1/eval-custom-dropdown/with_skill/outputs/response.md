# Fixing Your Custom Player Search Combobox for Screen Readers

Your component is a classic combobox (autocomplete) pattern — a text input that controls a filtered list. Right now it's two disconnected elements with no semantics, so screen readers have no way to understand the relationship between the input and the list, know that the list exists, navigate into it, or announce the currently highlighted option.

Here is exactly what to fix.

---

## Pillars involved

- **ARIA** — combobox role, listbox/option roles, states (aria-expanded, aria-activedescendant, aria-autocomplete)
- **Keyboard** — Down arrow enters list, Enter selects, Escape dismisses, Up/Down navigate options
- **AT Compatibility** — screen readers need all three of the above to work together

---

## What is wrong with the current markup

A plain `<input>` and a `<ul>` are invisible to assistive technology as a combined widget. Screen readers will:

- Read the input as a generic text field with no hint that a list exists
- Not announce when the list appears or disappears
- Not announce which option is highlighted as you arrow through the list
- Give no indication that clicking an item adds a player to the roster

---

## The fix: implement the APG combobox pattern

This is the correct WCAG-compliant markup (WCAG 4.1.2 — Name, Role, Value; plus the ARIA combobox pattern):

```html
<!-- 1. Label the input with a visible <label> -->
<label for="player-search">Search players</label>

<!-- 2. The input gets role="combobox" plus state attributes -->
<input
  id="player-search"
  type="text"
  role="combobox"
  aria-expanded="false"
  aria-autocomplete="list"
  aria-controls="player-listbox"
  aria-activedescendant=""
  autocomplete="off"
/>

<!-- 3. The list gets role="listbox"; each item gets role="option" with a unique id -->
<ul
  id="player-listbox"
  role="listbox"
  aria-label="Player suggestions"
  hidden
>
  <li role="option" id="player-opt-1" aria-selected="false">Justin Jefferson</li>
  <li role="option" id="player-opt-2" aria-selected="false">CeeDee Lamb</li>
  <li role="option" id="player-opt-3" aria-selected="false">Ja'Marr Chase</li>
</ul>

<!-- 4. A live region to announce result count (polite) -->
<div aria-live="polite" aria-atomic="true" class="sr-only" id="search-status"></div>
```

---

## Attribute-by-attribute explanation

| Attribute | Where | What it does |
|---|---|---|
| `role="combobox"` | `<input>` | Tells screen readers this input controls a popup list |
| `aria-expanded="false"/"true"` | `<input>` | Announces whether the list is open. Update this in JS when the list appears/disappears |
| `aria-autocomplete="list"` | `<input>` | Tells AT that the input filters a list (not inline completion) |
| `aria-controls="player-listbox"` | `<input>` | Links the input to the listbox by ID |
| `aria-activedescendant="player-opt-N"` | `<input>` | Points to the currently highlighted option's ID. Screen readers announce this option when it changes. Set to `""` when nothing is highlighted |
| `role="listbox"` | `<ul>` | Makes the list a proper listbox popup |
| `role="option"` | each `<li>` | Makes each item a selectable option |
| `aria-selected="false"/"true"` | each `<li>` | Indicates selection state; set to `"true"` on the highlighted/selected item |
| `hidden` | `<ul>` | Hides the list from both visual users and AT when closed; remove the attribute (don't just `display:none` via CSS) when opening |

---

## Required keyboard behavior

Per the ARIA Authoring Practices Guide combobox pattern:

| Key | Behavior |
|---|---|
| Any character | Filters the list; opens listbox if closed |
| `Down Arrow` | If list is closed, opens it. Moves virtual focus to first option |
| `Up Arrow` | Moves virtual focus to previous option |
| `Enter` | Selects the focused option, adds player to roster, closes list, returns focus to input |
| `Escape` | Closes list without selecting, returns to input |
| `Tab` | Closes list, moves focus to next element in page |

"Virtual focus" here means: visual highlight on the `<li>`, with `aria-activedescendant` on the `<input>` updated to that option's ID. **Real focus never leaves the input.** This is the key technique — do not move `focus()` into the listbox.

---

## JavaScript wiring

```js
const input = document.getElementById('player-search');
const listbox = document.getElementById('player-listbox');
const status = document.getElementById('search-status');
let activeIndex = -1;

function getOptions() {
  return Array.from(listbox.querySelectorAll('[role="option"]'));
}

function openList() {
  listbox.removeAttribute('hidden');
  input.setAttribute('aria-expanded', 'true');
}

function closeList() {
  listbox.setAttribute('hidden', '');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-activedescendant', '');
  activeIndex = -1;
  clearHighlight();
}

function clearHighlight() {
  getOptions().forEach(opt => {
    opt.setAttribute('aria-selected', 'false');
    opt.classList.remove('highlighted');
  });
}

function setActiveOption(index) {
  const options = getOptions();
  if (index < 0 || index >= options.length) return;
  clearHighlight();
  activeIndex = index;
  const opt = options[index];
  opt.setAttribute('aria-selected', 'true');
  opt.classList.add('highlighted');
  input.setAttribute('aria-activedescendant', opt.id);
}

function selectOption(index) {
  const options = getOptions();
  const opt = options[index];
  if (!opt) return;
  addPlayerToRoster(opt.textContent); // your existing add logic
  input.value = '';
  closeList();
  // Optionally announce the selection
  status.textContent = `${opt.textContent} added to roster.`;
}

// Filter on input
input.addEventListener('input', () => {
  const query = input.value.trim().toLowerCase();
  filterPlayers(query); // your existing filter logic — updates the <li> list
  if (query.length > 0) {
    openList();
    const count = getOptions().length;
    status.textContent = count === 0
      ? 'No players found.'
      : `${count} player${count !== 1 ? 's' : ''} found.`;
  } else {
    closeList();
    status.textContent = '';
  }
  activeIndex = -1;
  input.setAttribute('aria-activedescendant', '');
});

// Keyboard navigation
input.addEventListener('keydown', (e) => {
  const options = getOptions();
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (listbox.hasAttribute('hidden')) openList();
      setActiveOption(Math.min(activeIndex + 1, options.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setActiveOption(Math.max(activeIndex - 1, 0));
      break;
    case 'Enter':
      e.preventDefault();
      if (activeIndex >= 0) selectOption(activeIndex);
      break;
    case 'Escape':
      closeList();
      break;
    case 'Tab':
      closeList();
      break;
  }
});

// Click to select
listbox.addEventListener('click', (e) => {
  const opt = e.target.closest('[role="option"]');
  if (!opt) return;
  const index = getOptions().indexOf(opt);
  selectOption(index);
  input.focus();
});

// Close on outside click
document.addEventListener('click', (e) => {
  if (!input.contains(e.target) && !listbox.contains(e.target)) {
    closeList();
  }
});
```

---

## The live region for result count

Screen readers do not automatically announce that a list appeared. The `aria-live="polite"` region in the markup above handles this. Update it after filtering:

```js
status.textContent = `${count} player${count !== 1 ? 's' : ''} found.`;
```

This announces "3 players found" without moving focus away from the input. This satisfies WCAG 4.1.3 (Status Messages).

---

## CSS: make the highlighted option visually obvious

```css
[role="option"].highlighted,
[role="option"]:hover {
  background-color: #1a56db;
  color: white;
  outline: 2px solid #1a56db; /* ensure it's not just color-only */
}
```

Do not rely solely on background color to indicate highlight — add an outline or border (WCAG 1.4.1 — Use of Color).

---

## What NOT to do

- **Do not move focus into the listbox.** Focus stays on the input. Use `aria-activedescendant` to track virtual focus. Moving real focus into the list breaks typing.
- **Do not use `role="menu"` / `role="menuitem"`.** Menu is for application action menus (like a right-click context menu), not for filtering search results. Use `listbox`/`option`.
- **Do not hide the listbox with `visibility: hidden` or `opacity: 0`.** Hidden elements need to be fully removed from the accessibility tree when closed. Use `hidden` attribute or `display: none`.
- **Do not skip the `<label>`.** An `aria-label` on the input is acceptable as a fallback, but a visible `<label>` is better — it also helps voice control users who say "click Search players" to target the field.

---

## Testing checklist

After implementing:

- [ ] Tab to the input — VoiceOver/NVDA should announce "Search players, combobox"
- [ ] Type a query — hear the result count announced
- [ ] Press Down Arrow — hear the first option announced (e.g., "Justin Jefferson, 1 of 3")
- [ ] Press Down Arrow again — hear next option
- [ ] Press Enter — player is added, list closes, focus returns to input
- [ ] Press Escape — list closes without adding anyone
- [ ] Click a player with the mouse — same result as Enter
- [ ] Test on NVDA + Chrome (Windows) and VoiceOver + Safari (macOS)

---

## WCAG criteria addressed

| Criterion | Level | How |
|---|---|---|
| 1.3.1 Info and Relationships | A | `role="combobox"`, `role="listbox"`, `role="option"` convey structure |
| 1.4.1 Use of Color | A | Highlight uses outline, not just background color |
| 2.1.1 Keyboard | A | Full keyboard navigation per APG combobox pattern |
| 4.1.2 Name, Role, Value | A | Input labeled, roles set, states (`aria-expanded`, `aria-selected`, `aria-activedescendant`) updated dynamically |
| 4.1.3 Status Messages | AA | Live region announces result count without moving focus |
