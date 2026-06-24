# Accessible Drag-and-Drop Roster Management

## Pillars That Apply

This task touches three pillars:
- **Keyboard** — the core interaction must be operable without a mouse
- **ARIA** — roles, states, and live regions to expose the interaction to the accessibility tree
- **AT Compatibility** — screen readers can't perceive drag-and-drop visually; they need an entirely parallel interaction model

---

## The Core Principle: Two Interaction Models, One Feature

Mouse drag-and-drop is inherently inaccessible to keyboard and screen reader users. The right solution is **not** to retrofit ARIA onto drag events — it is to build a fully parallel keyboard interaction that accomplishes the same goal. Both paths should feel like first-class experiences, not workarounds.

---

## Keyboard Interaction Pattern

Follow the ARIA Authoring Practices Guide (APG) "Drag and Drop" pattern. The standard approach is a two-phase keyboard interaction:

1. **Select** the player to move (Enter or Space on the player item)
2. **Place** the player into a roster slot (Enter or Space on the target slot)

Escape cancels the operation at any point.

### Key mapping

| Key | Action |
|---|---|
| `Tab` | Move between players in the Available list and roster slots |
| `Enter` or `Space` | Pick up the focused player (begins "drag" mode) |
| `Tab` / `Shift+Tab` | While holding, navigate to target roster slots |
| `Enter` or `Space` | Drop the player into the focused slot |
| `Escape` | Cancel the pick-up; return focus to the player that was selected |
| `Arrow keys` (optional) | Move between items within a list region |

---

## HTML Structure

Use semantic list elements. The `listbox` / `option` ARIA pattern is the right choice here — it maps directly to "select from a list of choices."

```html
<!-- Available Players list -->
<section aria-labelledby="available-heading">
  <h2 id="available-heading">Available Players</h2>
  <ul
    role="listbox"
    aria-label="Available players"
    aria-multiselectable="false"
    id="available-players"
  >
    <li
      role="option"
      aria-selected="false"
      tabindex="0"
      id="player-1"
      aria-describedby="player-1-hint"
    >
      Justin Jefferson — WR, MIN
      <span class="sr-only" id="player-1-hint">
        Press Enter or Space to select and move to roster
      </span>
    </li>
    <li
      role="option"
      aria-selected="false"
      tabindex="-1"
      id="player-2"
    >
      CeeDee Lamb — WR, DAL
    </li>
    <!-- ... -->
  </ul>
</section>

<!-- Roster Slots -->
<section aria-labelledby="roster-heading">
  <h2 id="roster-heading">My Roster</h2>
  <ul aria-label="Roster slots" id="roster-slots">
    <li
      class="roster-slot"
      role="option"
      aria-selected="false"
      tabindex="-1"
      id="slot-qb"
      aria-label="QB slot — empty"
    >
      QB — Empty
    </li>
    <li
      class="roster-slot"
      role="option"
      aria-selected="false"
      tabindex="-1"
      id="slot-wr1"
      aria-label="WR1 slot — Justin Jefferson"
    >
      WR1 — Justin Jefferson
    </li>
    <!-- ... -->
  </ul>
</section>

<!-- Live region for status announcements -->
<div
  id="roster-status"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
></div>
```

---

## ARIA States During Interaction

When a player is "picked up" (selected for moving), update states to communicate the active drag:

```js
function pickUpPlayer(playerElement) {
  // Mark the player as selected/grabbed
  playerElement.setAttribute('aria-selected', 'true');
  playerElement.setAttribute('aria-grabbed', 'true'); // deprecated but still used by some AT
  playerElement.classList.add('is-grabbed');

  // Announce what happened
  announce(`${playerElement.textContent.trim()} selected. Navigate to a roster slot and press Enter to place, or press Escape to cancel.`);

  // Make roster slots focusable and indicate they are drop targets
  document.querySelectorAll('.roster-slot').forEach(slot => {
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('aria-dropeffect', 'move'); // deprecated but supported by older AT
  });

  // Move focus to the first available slot
  document.querySelector('.roster-slot')?.focus();
}

function dropPlayer(playerElement, slotElement) {
  const playerName = playerElement.textContent.trim();
  const slotName = slotElement.dataset.slotLabel; // e.g. "WR1"

  // Update the DOM
  slotElement.textContent = `${slotName} — ${playerName}`;
  slotElement.setAttribute('aria-label', `${slotName} slot — ${playerName}`);

  // Remove the player from available list
  playerElement.remove();

  // Reset drag state
  resetDragState();

  // Announce the result
  announce(`${playerName} moved to ${slotName}.`);

  // Return focus to the available players list or next player
  document.querySelector('[role="listbox"]')?.focus();
}

function cancelPickUp(playerElement) {
  resetDragState();
  announce('Move cancelled.');
  playerElement.focus();
}

function resetDragState() {
  document.querySelectorAll('[aria-selected="true"]').forEach(el => {
    el.setAttribute('aria-selected', 'false');
    el.removeAttribute('aria-grabbed');
  });
  document.querySelectorAll('.roster-slot').forEach(slot => {
    slot.setAttribute('tabindex', '-1');
    slot.removeAttribute('aria-dropeffect');
  });
}
```

---

## Live Region Announcements

The live region drives all screen reader feedback. Never move focus to announce a status — use the live region.

```js
const statusRegion = document.getElementById('roster-status');

function announce(message) {
  // Clear first so the same message re-announces if repeated
  statusRegion.textContent = '';
  // Small delay ensures the cleared state is registered before the new text
  requestAnimationFrame(() => {
    statusRegion.textContent = message;
  });
}
```

**What to announce:**
- When a player is picked up: `"Justin Jefferson selected. Tab to a roster slot and press Enter to place. Press Escape to cancel."`
- When a drop succeeds: `"Justin Jefferson moved to WR1."`
- When cancelled: `"Move cancelled."`
- When a slot is already occupied: `"WR1 slot is occupied by CeeDee Lamb. Press Enter to swap, or press Escape to cancel."`

Use `role="status"` (polite) for success messages. If you need to announce an error immediately, use `role="alert"` (assertive) instead.

---

## Focus Management

- **Tab order at rest:** Available players list → Roster slots, in DOM order. Only one item per list should be in the natural tab order at a time (use arrow keys within a list via the `roving tabindex` pattern — set `tabindex="0"` on the active item, `tabindex="-1"` on all others).
- **When pick-up begins:** Move focus to the first valid drop target (roster slot).
- **After drop:** Move focus back to the available players list (or the next player in line).
- **After cancel (Escape):** Return focus to the player that was picked up.

Do not let focus escape to unrelated parts of the page during an active pick-up operation.

---

## Roving Tabindex Within the Available Players List

```js
const listbox = document.getElementById('available-players');
const players = () => listbox.querySelectorAll('[role="option"]');

listbox.addEventListener('keydown', (e) => {
  const items = [...players()];
  const current = document.activeElement;
  const index = items.indexOf(current);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = items[index + 1] ?? items[0];
    setFocus(next);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = items[index - 1] ?? items[items.length - 1];
    setFocus(prev);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    pickUpPlayer(current);
  }
});

function setFocus(element) {
  players().forEach(p => p.setAttribute('tabindex', '-1'));
  element.setAttribute('tabindex', '0');
  element.focus();
}
```

---

## What Not to Do

**Do not rely on `ondragstart` / `ondrop` events for keyboard users.** These events only fire for mouse/pointer interactions. Keyboard users will never trigger them.

**Do not use `aria-grabbed` alone as the only signal.** It was deprecated in ARIA 1.1 because it was inconsistently supported. Use it as a supplement, but rely on `aria-selected` and live region announcements as the primary communication mechanism.

**Do not move focus to the live region.** It should have `class="sr-only"` and never receive focus. Moving focus to a status message disorients users.

**Do not use positive `tabindex` values** (e.g., `tabindex="2"`) to control order. This breaks the natural tab sequence for all keyboard users.

**Do not make the available label differ from the visible text** for voice control users. Someone using Dragon NaturallySpeaking says what they see. If the visible slot label is "WR1" but `aria-label` is "Wide Receiver One slot", the voice command "click WR1" will fail.

---

## Visual Indicator for "Grabbed" State

Keyboard users need a visual cue that a player is currently picked up. Use a CSS class tied to the grabbed state:

```css
[aria-selected="true"].is-grabbed {
  outline: 3px dashed var(--color-primary);
  background: var(--color-highlight);
}

.roster-slot[aria-dropeffect="move"] {
  border: 2px dashed var(--color-primary);
  background: var(--color-drop-target);
}
```

This satisfies WCAG 1.4.1 (Use of Color) — don't signal the grabbed state with color alone.

---

## WCAG Criteria This Covers

| Criterion | Requirement |
|---|---|
| **2.1.1 Keyboard (A)** | All drag-and-drop functionality available via keyboard |
| **2.1.2 No Keyboard Trap (A)** | Users can Tab out of the roster builder |
| **2.4.3 Focus Order (A)** | Tab order is logical and follows visual layout |
| **2.4.7 Focus Visible (AA)** | Focus indicator visible on every interactive element |
| **4.1.2 Name, Role, Value (A)** | All controls have accessible names; states (selected, grabbed) are exposed |
| **4.1.3 Status Messages (AA)** | Drop confirmations announced via live region without moving focus |

---

## Testing Checklist

- [ ] Tab through the full roster builder without a mouse — can you reach every player and every slot?
- [ ] Pick up a player with Enter/Space; navigate to a slot; drop with Enter — does it work?
- [ ] Press Escape mid-interaction — is the operation cancelled and focus returned correctly?
- [ ] Turn on VoiceOver (Cmd+F5 on Mac) — are pick-up, navigation, and drop all announced?
- [ ] Turn on NVDA — repeat the same flow; check live region announcements fire
- [ ] Check that the "grabbed" player and "drop target" slots have visible focus indicators
- [ ] Verify slot labels match visible text (voice control compatibility)
- [ ] Run axe DevTools on the roster page — resolve all violations before shipping
