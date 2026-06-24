# Making a Custom Player Search Combobox Accessible

A screen reader user is right — a plain `<input>` and `<ul>` combo with no ARIA attributes is essentially invisible to assistive technology. The browser has no idea these two elements are related, that the list is a set of selectable options, or what state the widget is in. Here is how to fix it completely.

---

## The Core Problem

Screen readers rely on semantic HTML and ARIA roles to understand UI. Your current widget looks like:
- An unlabeled text box
- A random list somewhere on the page

The screen reader cannot tell the user: "This input controls a dropdown of player options," "There are 12 results," "You are on result 3 of 12," or "Press Enter to select."

---

## The Fix: ARIA Combobox Pattern

The WAI-ARIA spec defines an explicit **combobox pattern** for exactly this use case. Here is the complete implementation.

### 1. HTML Structure

```html
<label for="player-search">Search players</label>

<div class="combobox-wrapper">
  <input
    type="text"
    id="player-search"
    role="combobox"
    aria-expanded="false"
    aria-autocomplete="list"
    aria-controls="player-listbox"
    aria-activedescendant=""
    autocomplete="off"
    spellcheck="false"
  />

  <ul
    id="player-listbox"
    role="listbox"
    aria-label="Players"
    hidden
  >
    <!-- Options injected by JS -->
    <li role="option" id="option-1" aria-selected="false">Patrick Mahomes</li>
    <li role="option" id="option-2" aria-selected="false">Justin Jefferson</li>
    <!-- etc. -->
  </ul>
</div>
```

**Key attributes explained:**

| Attribute | Where | Purpose |
|---|---|---|
| `role="combobox"` | input | Tells screen readers this input controls a popup list |
| `aria-expanded` | input | "false" when list is hidden, "true" when visible |
| `aria-controls` | input | Points to the listbox element by ID |
| `aria-autocomplete="list"` | input | Tells screen readers suggestions appear in a list |
| `aria-activedescendant` | input | ID of the currently highlighted option (keyboard nav) |
| `role="listbox"` | ul | Identifies the popup as a selectable list |
| `role="option"` | li | Each item is a selectable option |
| `aria-selected` | li | "true" on the currently focused/highlighted option |
| `hidden` | ul | Native HTML attribute to hide the list (better than CSS-only) |


### 2. JavaScript — The Full Behavior

```javascript
const input = document.getElementById('player-search');
const listbox = document.getElementById('player-listbox');
let activeIndex = -1;
let filteredPlayers = [];

// --- Filtering ---
input.addEventListener('input', () => {
  const query = input.value.trim().toLowerCase();
  activeIndex = -1;
  input.setAttribute('aria-activedescendant', '');

  if (query.length === 0) {
    closeListbox();
    return;
  }

  filteredPlayers = allPlayers.filter(p =>
    p.name.toLowerCase().includes(query)
  );

  renderOptions(filteredPlayers);

  if (filteredPlayers.length > 0) {
    openListbox();
  } else {
    closeListbox();
    // Optional: announce no results
    announceToScreenReader('No players found.');
  }
});

// --- Render options ---
function renderOptions(players) {
  listbox.innerHTML = '';
  players.forEach((player, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('id', `option-${i}`);
    li.setAttribute('aria-selected', 'false');
    li.textContent = `${player.name} — ${player.position}, ${player.team}`;
    li.addEventListener('mousedown', (e) => {
      // mousedown instead of click so it fires before input blur
      e.preventDefault();
      selectPlayer(i);
    });
    listbox.appendChild(li);
  });
}

// --- Open / close ---
function openListbox() {
  listbox.removeAttribute('hidden');
  input.setAttribute('aria-expanded', 'true');
}

function closeListbox() {
  listbox.setAttribute('hidden', '');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-activedescendant', '');
  activeIndex = -1;
  clearOptionSelection();
}

input.addEventListener('blur', () => {
  // Small delay so mousedown on an option can fire first
  setTimeout(closeListbox, 150);
});

// --- Keyboard navigation ---
input.addEventListener('keydown', (e) => {
  const optionCount = filteredPlayers.length;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (!listbox.hasAttribute('hidden') && optionCount > 0) {
        activeIndex = (activeIndex + 1) % optionCount;
        updateActiveOption();
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (!listbox.hasAttribute('hidden') && optionCount > 0) {
        activeIndex = (activeIndex - 1 + optionCount) % optionCount;
        updateActiveOption();
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (activeIndex >= 0) {
        selectPlayer(activeIndex);
      }
      break;

    case 'Escape':
      closeListbox();
      break;

    case 'Tab':
      closeListbox();
      break;
  }
});

function updateActiveOption() {
  clearOptionSelection();
  const options = listbox.querySelectorAll('[role="option"]');
  if (options[activeIndex]) {
    options[activeIndex].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', options[activeIndex].id);
    // Scroll into view if needed
    options[activeIndex].scrollIntoView({ block: 'nearest' });
  }
}

function clearOptionSelection() {
  listbox.querySelectorAll('[role="option"]').forEach(opt => {
    opt.setAttribute('aria-selected', 'false');
  });
}

// --- Select and add to roster ---
function selectPlayer(index) {
  const player = filteredPlayers[index];
  addToRoster(player); // your existing logic
  input.value = '';
  closeListbox();
  announceToScreenReader(`${player.name} added to your roster.`);
  input.focus();
}

// --- Live region for announcements ---
function announceToScreenReader(message) {
  const announcer = document.getElementById('sr-announcer');
  announcer.textContent = '';
  // Small timeout ensures the DOM change is picked up
  setTimeout(() => { announcer.textContent = message; }, 50);
}
```

### 3. The Live Region (add once to your page)

```html
<div
  id="sr-announcer"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
></div>
```

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

The live region lets you announce dynamic things — "3 players found," "Patrick Mahomes added to your roster" — without moving focus away from the input.

---

## Result Count Announcement (Optional but Highly Recommended)

After filtering, announce how many results appeared so the user knows whether to arrow down:

```javascript
function renderOptions(players) {
  // ... existing render code ...

  if (players.length > 0) {
    announceToScreenReader(`${players.length} player${players.length === 1 ? '' : 's'} found. Use arrow keys to browse.`);
  }
}
```

---

## CSS — Keep the List Visually Correct

Make sure the listbox is positioned correctly and options have visible focus styles:

```css
.combobox-wrapper {
  position: relative;
  display: inline-block;
}

#player-listbox {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #ccc;
  background: white;
  z-index: 100;
}

#player-listbox [role="option"] {
  padding: 8px 12px;
  cursor: pointer;
}

#player-listbox [aria-selected="true"] {
  background-color: #0057b8;
  color: white;
  outline: 2px solid #003d85; /* visible focus indicator */
}

#player-listbox [role="option"]:hover {
  background-color: #e8f0fe;
}
```

---

## Checklist: What Each Fix Solves

| Problem | Fix |
|---|---|
| Screen reader doesn't know input and list are related | `aria-controls` on the input pointing to the listbox ID |
| No announcement when list opens/closes | `aria-expanded` toggled on the input |
| Reader can't tell what item is highlighted | `aria-activedescendant` updated on keydown |
| List items have no semantic meaning | `role="listbox"` on ul, `role="option"` on each li |
| No way to know which item is selected | `aria-selected="true"` on active option |
| No feedback when player is added | `aria-live` region announces confirmation |
| Input has no label | `<label for="player-search">` |
| Result count unknown | Live region announces count after filtering |

---

## Testing

1. **NVDA + Chrome** or **JAWS + Chrome** on Windows
2. **VoiceOver + Safari** on Mac (Cmd+F5 to enable)
3. **Axe DevTools** browser extension for automated checks
4. Keyboard-only test: Tab to input, type a name, Arrow Down through options, Enter to select, Escape to dismiss — all without touching the mouse.

The screen reader experience you should aim for: the user types in the field, hears "3 players found, use arrow keys to browse," presses Arrow Down and hears "Patrick Mahomes — QB, Chiefs, 1 of 3," presses Enter and hears "Patrick Mahomes added to your roster."
