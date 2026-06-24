# Making Drag-and-Drop Roster Management Fully Accessible

Drag-and-drop interfaces are one of the most common accessibility gaps in web apps. The good news: you don't need to replace your drag-and-drop — you need to provide a parallel interaction model that achieves the same outcome without requiring mouse precision. Here is a complete approach.

---

## Core Principle

**Never rely solely on drag-and-drop.** WCAG 2.1 Success Criterion 2.5.7 (WCAG 2.2) and the older 2.1.1 both require that all functionality be operable via keyboard. The pattern is: keep your visual drag-and-drop for mouse users, and layer on keyboard and screen reader interactions that accomplish the same goal.

---

## 1. Keyboard Interaction Pattern

The most widely accepted keyboard pattern for drag-and-drop lists is:

1. User tabs to a player in the Available Players list.
2. User presses **Space** or **Enter** to "pick up" the player (enter drag mode).
3. User presses **Arrow keys** (or Tab) to navigate to a target roster slot.
4. User presses **Space** or **Enter** to "drop" the player into that slot.
5. User presses **Escape** to cancel and return the player to the original position.

This mirrors the ARIA Authoring Practices Guide (APG) pattern for listbox rearrangement.

### Implementation

```html
<!-- Available Players list -->
<ul role="listbox" aria-label="Available Players" id="available-players">
  <li
    role="option"
    tabindex="0"
    aria-selected="false"
    data-player-id="42"
    class="player-card"
  >
    Patrick Mahomes — QB
  </li>
  <!-- more players -->
</ul>

<!-- Roster Slots -->
<ul role="listbox" aria-label="Roster Slots" id="roster-slots">
  <li
    role="option"
    tabindex="0"
    aria-label="QB slot — empty"
    data-slot="QB"
    class="roster-slot"
  >
    QB (empty)
  </li>
  <!-- more slots -->
</ul>
```

```javascript
let draggedPlayer = null;

document.querySelectorAll('.player-card').forEach(card => {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!draggedPlayer) {
        // Pick up
        draggedPlayer = card;
        card.setAttribute('aria-grabbed', 'true');
        card.classList.add('is-dragging');
        announceToScreenReader(`Picked up ${card.textContent.trim()}. Use Tab or Arrow keys to navigate to a roster slot, then press Enter or Space to drop.`);
      }
    }
    if (e.key === 'Escape' && draggedPlayer === card) {
      cancelDrag();
    }
  });
});

document.querySelectorAll('.roster-slot').forEach(slot => {
  slot.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && draggedPlayer) {
      e.preventDefault();
      dropPlayerIntoSlot(draggedPlayer, slot);
    }
  });
  // Also support click drop when in drag mode
  slot.addEventListener('click', () => {
    if (draggedPlayer) dropPlayerIntoSlot(draggedPlayer, slot);
  });
});

function dropPlayerIntoSlot(player, slot) {
  const playerName = player.textContent.trim();
  const slotName = slot.dataset.slot;
  // ... your roster update logic ...
  announceToScreenReader(`${playerName} added to ${slotName} slot.`);
  player.removeAttribute('aria-grabbed');
  player.classList.remove('is-dragging');
  draggedPlayer = null;
  slot.focus(); // Return focus to the slot that received the drop
}

function cancelDrag() {
  if (!draggedPlayer) return;
  draggedPlayer.removeAttribute('aria-grabbed');
  draggedPlayer.classList.remove('is-dragging');
  announceToScreenReader('Drop cancelled.');
  draggedPlayer.focus();
  draggedPlayer = null;
}
```

---

## 2. Screen Reader Announcements

Screen readers cannot perceive drag state visually. You must communicate it through:

### Live Region for Status Messages

```html
<!-- Place this in your HTML, hidden visually but read by screen readers -->
<div
  id="drag-announce"
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

```javascript
function announceToScreenReader(message) {
  const el = document.getElementById('drag-announce');
  // Clear first, then set — ensures re-announcement of the same message
  el.textContent = '';
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}
```

### What to announce at each step:

| Event | Announcement |
|---|---|
| Pick up player | "Picked up [Player Name]. Navigate to a roster slot and press Enter or Space to drop, or press Escape to cancel." |
| Navigate to a slot (focus) | "[Slot name] slot, [empty / occupied by Player X]." |
| Successful drop | "[Player Name] moved to [Slot Name] slot." |
| Drop on occupied slot | "[Player Name] replaced [Previous Player] in [Slot Name] slot." |
| Cancel | "Drop cancelled. [Player Name] returned to available players." |
| Error | "Cannot add [Player Name] to [Slot Name]. [Reason]." |

---

## 3. ARIA Attributes

Use these attributes to communicate drag state semantically:

```html
<!-- On draggable items -->
<li
  role="option"
  draggable="true"
  aria-grabbed="false"      <!-- true when picked up, false otherwise -->
  tabindex="0"
  aria-describedby="drag-instructions"
>
  Patrick Mahomes — QB
</li>

<!-- Instruction text (can be visually hidden) -->
<p id="drag-instructions" class="sr-only">
  Press Enter or Space to pick up this player, then navigate to a roster slot and press Enter or Space to drop.
</p>

<!-- On drop targets -->
<li
  role="option"
  aria-dropeffect="move"    <!-- signals this is a valid drop zone -->
  tabindex="0"
  aria-label="QB slot — empty"
>
  QB
</li>
```

Note: `aria-grabbed` and `aria-dropeffect` are deprecated in ARIA 1.1 but still have good screen reader support. They are safe to use alongside live region announcements.

---

## 4. Alternative: Action Menu Pattern

For complex rosters, consider also offering a "Move" menu as a complementary pattern. This is especially useful for users who find the pick-up/navigate/drop flow confusing:

```html
<li role="option" tabindex="0" class="player-card">
  Patrick Mahomes — QB
  <button
    aria-label="Actions for Patrick Mahomes"
    aria-haspopup="true"
    class="player-actions-btn"
  >
    ⋮
  </button>
  <ul role="menu" hidden>
    <li role="menuitem" tabindex="-1">Add to QB Slot</li>
    <li role="menuitem" tabindex="-1">Add to FLEX Slot</li>
    <li role="menuitem" tabindex="-1">Add to Bench</li>
  </ul>
</li>
```

This gives screen reader users a familiar, unambiguous interaction and is particularly good as a fallback.

---

## 5. Focus Management

Focus management is critical. Follow these rules:

- **After picking up a player:** Keep focus on the player card. Move focus only when the user explicitly navigates.
- **After dropping:** Move focus to the roster slot that received the player so the user can confirm the action.
- **After cancelling:** Return focus to the player card that was picked up.
- **After a slot is filled and a player removed from available list:** If the player's original element is removed from the DOM, move focus to the next player in the list, or to the list container if no players remain.

```javascript
function dropPlayerIntoSlot(player, slot) {
  // ... update data and DOM ...

  // Remove player from available list
  const nextFocusable = player.nextElementSibling || player.previousElementSibling;
  player.remove(); // or move it visually

  slot.focus(); // Focus the receiving slot
  announceToScreenReader(`${playerName} added to ${slotName} slot.`);
}
```

---

## 6. Visual Indicators

Keyboard and screen reader users also benefit from clear visual states:

```css
/* Show drag mode clearly */
.player-card.is-dragging {
  outline: 3px solid #0066cc;
  background-color: #e8f0fe;
  cursor: grabbing;
}

/* Show valid drop targets when in drag mode */
.drag-active .roster-slot {
  border: 2px dashed #0066cc;
}

/* Highlight focused drop target */
.roster-slot:focus {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
  background-color: #f0f7ff;
}

/* Never remove focus outline */
:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
}
```

---

## 7. Native HTML5 Drag Events — Keep Them Working Too

Your mouse drag-and-drop should still work with proper ARIA. Add drag event handlers alongside the keyboard handlers:

```javascript
card.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/plain', card.dataset.playerId);
  e.dataTransfer.effectAllowed = 'move';
  card.setAttribute('aria-grabbed', 'true');
});

card.addEventListener('dragend', () => {
  card.setAttribute('aria-grabbed', 'false');
  card.classList.remove('is-dragging');
});

slot.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  slot.classList.add('drag-over');
});

slot.addEventListener('drop', (e) => {
  e.preventDefault();
  const playerId = e.dataTransfer.getData('text/plain');
  const player = document.querySelector(`[data-player-id="${playerId}"]`);
  dropPlayerIntoSlot(player, slot);
  slot.classList.remove('drag-over');
});
```

---

## 8. Testing Checklist

Before shipping, verify the following:

**Keyboard:**
- [ ] Every player card and roster slot is reachable via Tab
- [ ] Pick up works with Enter and Space
- [ ] Arrow keys or Tab navigates between slots while holding a player
- [ ] Drop works with Enter and Space on any valid slot
- [ ] Escape cancels drag and returns focus correctly
- [ ] Focus never gets lost or trapped unexpectedly

**Screen Reader (test with NVDA+Firefox, JAWS+Chrome, VoiceOver+Safari):**
- [ ] Player names and positions are announced on focus
- [ ] Slot names and current occupants are announced on focus
- [ ] Pick-up announcement fires and includes instructions
- [ ] Navigation between slots announces slot state
- [ ] Drop confirmation is announced
- [ ] Cancel announcement fires
- [ ] Error messages are announced

**General:**
- [ ] No information conveyed by color alone
- [ ] All focus states are clearly visible (3:1 contrast minimum against background)
- [ ] Touch device users can also complete the action (tap to select, tap to place)

---

## Summary

The key moves are:
1. Implement a keyboard pick-up/navigate/drop pattern using Space/Enter to grab and drop, Escape to cancel.
2. Use an `aria-live` region to announce every state change to screen readers.
3. Manage focus deliberately — always leave the user somewhere logical.
4. Offer an action menu as a simpler fallback for complex roster operations.
5. Keep your mouse drag-and-drop working alongside these enhancements — they are additive, not replacements.

This approach satisfies WCAG 2.1 SC 2.1.1 (Keyboard), SC 2.4.3 (Focus Order), SC 2.4.7 (Focus Visible), and SC 4.1.3 (Status Messages), which are the primary criteria at play for this pattern.
