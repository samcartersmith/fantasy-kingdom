# Accessible "Confirm Trade" Modal Dialog in React

## Overview

A modal dialog that is fully accessible requires four things working together:
1. Correct HTML/ARIA structure so screen readers understand what they're looking at
2. Focus management so keyboard users can interact with it
3. Keyboard behavior matching the ARIA Authoring Practices Guide (APG) dialog pattern
4. Background inertness so users cannot accidentally interact with content behind the modal

---

## Complete Implementation

```jsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function ConfirmTradeModal({ isOpen, tradeDetails, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);

  // Focus management: move focus into the modal when it opens
  useEffect(() => {
    if (isOpen) {
      // Small timeout ensures the DOM has rendered before we shift focus
      const id = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Keyboard behavior: trap focus inside dialog, close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;

        // Find all focusable elements inside the dialog
        const focusableSelectors = [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(", ");

        const focusableElements = Array.from(
          dialog.querySelectorAll(focusableSelectors)
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if focus is on the first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if focus is on the last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop: visible overlay, clicking it cancels the dialog */}
      <div
        className="modal-backdrop"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* The dialog itself */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-dialog-title"
        aria-describedby="trade-dialog-desc"
        ref={dialogRef}
        className="modal-dialog"
      >
        <h2 id="trade-dialog-title">Confirm Trade</h2>

        <div id="trade-dialog-desc">
          <p>Please review the trade details below before sending your offer.</p>

          <div className="trade-details">
            <div className="trade-side">
              <h3>You give:</h3>
              <ul>
                {tradeDetails.giving.map((player) => (
                  <li key={player.id}>{player.name} ({player.position})</li>
                ))}
              </ul>
            </div>
            <div className="trade-side">
              <h3>You receive:</h3>
              <ul>
                {tradeDetails.receiving.map((player) => (
                  <li key={player.id}>{player.name} ({player.position})</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="modal-actions" role="group" aria-label="Trade actions">
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary"
          >
            Send Offer
          </button>
          <button
            type="button"
            onClick={onCancel}
            ref={cancelButtonRef}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
```

---

## Usage Example

```jsx
function TradeProposal() {
  const [modalOpen, setModalOpen] = useState(false);

  const tradeDetails = {
    giving: [{ id: 1, name: "Justin Jefferson", position: "WR" }],
    receiving: [{ id: 2, name: "Tyreek Hill", position: "WR" }],
  };

  function handleProposeTrade() {
    setModalOpen(true);
  }

  function handleSendOffer() {
    // submit trade logic here
    setModalOpen(false);
  }

  function handleCancel() {
    setModalOpen(false);
    // Return focus to the trigger button — see note below
  }

  return (
    <div>
      <button type="button" onClick={handleProposeTrade}>
        Propose Trade
      </button>

      <ConfirmTradeModal
        isOpen={modalOpen}
        tradeDetails={tradeDetails}
        onConfirm={handleSendOffer}
        onCancel={handleCancel}
      />
    </div>
  );
}
```

---

## Key Decisions Explained

### 1. ARIA Attributes

| Attribute | Element | Why |
|-----------|---------|-----|
| `role="dialog"` | Container div | Tells assistive technology this is a dialog. Screen readers announce it as such when focus moves in. |
| `aria-modal="true"` | Container div | Signals to modern screen readers that content outside the dialog is inert. Not a substitute for real DOM inertness (see below), but required for proper screen reader behavior. |
| `aria-labelledby="trade-dialog-title"` | Container div | Associates the `<h2>` as the dialog's accessible name. Screen readers announce the heading when the dialog opens. |
| `aria-describedby="trade-dialog-desc"` | Container div | Associates the descriptive content as the dialog's accessible description. Some screen readers read this automatically after the label. |
| `aria-hidden="true"` | Backdrop div | Prevents the decorative backdrop from being announced or focused by screen readers. |

### 2. Focus Management

**On open:** Focus moves to the Cancel button (not Send Offer) as the initial focus target. This is intentional — it's the safer, more conservative action. Placing focus on a destructive or irreversible action ("Send Offer") as the default risks accidental activation by screen reader users or keyboard-only users who press Space or Enter immediately after the modal opens.

**On close:** Focus must return to the element that triggered the modal (the "Propose Trade" button). Without this, keyboard users lose their place in the page. Implement this by storing a ref to the trigger button and calling `.focus()` on it when the modal closes:

```jsx
const triggerRef = useRef(null);

function handleProposeTrade() {
  setModalOpen(true);
}

function handleClose() {
  setModalOpen(false);
  // Return focus to the trigger after state updates
  setTimeout(() => triggerRef.current?.focus(), 0);
}

// In JSX:
<button type="button" ref={triggerRef} onClick={handleProposeTrade}>
  Propose Trade
</button>
```

### 3. Focus Trap

The Tab and Shift+Tab behavior cycles focus within the dialog. Without this, Tab from the last button would move focus to the browser's address bar or other browser UI, leaving the modal visually present but functionally abandoned for keyboard users — a disorienting experience.

The implementation queries all focusable elements dynamically, which correctly handles conditionally rendered content inside the modal.

### 4. Escape Key

Pressing Escape closes the modal (calling `onCancel`). This is required by the ARIA APG dialog pattern and is the expected behavior users have learned from native OS dialogs. It should behave identically to clicking Cancel.

### 5. Background Inertness

`aria-modal="true"` helps screen readers, but browsers do not enforce DOM inertness based on ARIA alone. Without additional measures, keyboard users can Tab out of the modal into background content, and screen readers with virtual cursor modes (like NVDA in browse mode) can read background content.

**Modern approach — the `inert` attribute:**

```jsx
useEffect(() => {
  if (!isOpen) return;

  // Make everything outside the modal inert
  const siblings = Array.from(document.body.children).filter(
    (el) => !el.contains(dialogRef.current) && el !== dialogRef.current
  );
  siblings.forEach((el) => el.setAttribute("inert", ""));
  return () => siblings.forEach((el) => el.removeAttribute("inert"));
}, [isOpen]);
```

The `inert` attribute (now baseline-available in all modern browsers) prevents focus, pointer events, and screen reader access to the marked elements. This is the most robust solution and eliminates the need for complex aria-hidden trees on background content.

**Alternative:** Libraries like `focus-trap-react` handle this well if you prefer not to implement it manually.

### 6. Portal Rendering

`createPortal(children, document.body)` renders the modal as a direct child of `<body>`, outside your React component tree's DOM position. This matters because:
- CSS stacking context issues (`z-index` conflicts) are avoided
- The modal won't be clipped by `overflow: hidden` ancestors
- Screen readers encounter the dialog at the top level of the document, which matches the expected document structure for dialogs

### 7. Heading Structure

The `<h2>` inside the dialog gives the dialog its accessible name via `aria-labelledby`. Using a real heading element (rather than a styled `<div>`) also gives screen reader users navigating by headings a way to jump to the dialog title.

The nested `<h3>` elements ("You give:" / "You receive:") are appropriate since they are subheadings within the dialog's content.

---

## CSS Considerations

```css
/* Backdrop */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

/* Dialog */
.modal-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 101;
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  /* Critical: ensure the dialog is visible in high-contrast mode */
  border: 2px solid transparent;
}

/* Ensure focus indicators are visible */
.modal-dialog button:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .modal-dialog {
    animation: none;
    transition: none;
  }
}
```

Do not use `outline: none` on focused buttons inside the dialog. Focus indicators are required for keyboard accessibility (WCAG 2.4.7, Success Criterion level AA).

---

## Testing Checklist

- [ ] **Screen reader announcement:** When the modal opens, NVDA/JAWS/VoiceOver announces the dialog role, title ("Confirm Trade"), and description
- [ ] **Initial focus:** First focused element after open is the Cancel button
- [ ] **Tab cycling:** Tab from Cancel goes to Send Offer; Tab from Send Offer goes back to Cancel
- [ ] **Shift+Tab cycling:** Works in reverse
- [ ] **Escape closes modal:** Focus returns to "Propose Trade" button
- [ ] **Cancel closes modal:** Focus returns to "Propose Trade" button
- [ ] **Send Offer submits:** Appropriate action fires, modal closes, focus returns
- [ ] **Background inertness:** Cannot Tab into background content while modal is open
- [ ] **No background reads:** Screen reader virtual cursor cannot reach background content
- [ ] **Focus indicator visible:** All focused buttons have clearly visible outlines
- [ ] **Color contrast:** Dialog text meets 4.5:1 contrast ratio (WCAG 1.4.3 AA)
- [ ] **Reduced motion:** No jarring animations if user has `prefers-reduced-motion: reduce` set

---

## WCAG Success Criteria Addressed

| Criterion | Level | How |
|-----------|-------|-----|
| 1.3.1 Info and Relationships | A | Semantic HTML (`role="dialog"`, headings, lists) |
| 1.4.3 Contrast (Minimum) | AA | Ensure sufficient text/button contrast |
| 2.1.1 Keyboard | A | Full keyboard operability, Tab trap, Escape |
| 2.1.2 No Keyboard Trap | A | Focus trap is intentional and escapable via Escape/Cancel |
| 2.4.3 Focus Order | A | Logical focus order within dialog |
| 2.4.7 Focus Visible | AA | Visible focus indicators on all interactive elements |
| 4.1.2 Name, Role, Value | A | `role="dialog"`, `aria-labelledby`, `aria-describedby`, `aria-modal` |

---

## Libraries Worth Knowing

If you want a battle-tested baseline instead of rolling your own:

- **Radix UI Dialog** (`@radix-ui/react-dialog`) — unstyled, fully accessible, handles focus trap, Escape, aria attributes, and portal rendering out of the box
- **React Aria** (`@react-aria/dialog`) — Adobe's accessibility library, extremely thorough ARIA implementation
- **Headless UI** (`@headlessui/react`) — Tailwind team's accessible primitives, includes a Dialog component

These are worth using in production because they handle edge cases (e.g., nested dialogs, scroll locking, iOS Safari quirks) that are tedious to implement correctly from scratch.
