# Accessible "Confirm Trade" Modal Dialog in React

## Pillars that apply

This task touches three pillars:
- **ARIA** — role, labeling, `aria-modal`
- **Keyboard** — focus trap, Escape to close, focus return
- **AT Compatibility** — screen reader announcement on open, correct dialog semantics

---

## The right HTML element: `<dialog>`

Use the native `<dialog>` element. It gives you `role="dialog"` semantics, focus management hooks, and Escape-to-close behavior for free. Do not use `<div role="dialog">` unless you need to support very old browsers where `<dialog>` is not available — and even then, the ARIA and keyboard work you'd have to add manually makes the native element the clearly better choice.

---

## Complete React Implementation

```tsx
import { useEffect, useRef } from 'react';

interface ConfirmTradeModalProps {
  isOpen: boolean;
  tradeDetails: {
    giving: string[];
    receiving: string[];
    leagueMate: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  triggerRef: React.RefObject<HTMLElement>; // ref to the "Propose Trade" button
}

export function ConfirmTradeModal({
  isOpen,
  tradeDetails,
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmTradeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open/close the native dialog and manage focus
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal(); // opens as a modal; browser handles backdrop and focus trap
    } else {
      dialog.close();
      // Return focus to the trigger when the modal closes
      triggerRef.current?.focus();
    }
  }, [isOpen, triggerRef]);

  // Handle Escape key — native <dialog> already fires 'cancel' on Escape,
  // but we wire it to our onCancel so React state stays in sync.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault(); // prevent the default close so React controls state
      onCancel();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="trade-dialog-title"
      aria-describedby="trade-dialog-desc"
      aria-modal="true"
    >
      <h2 id="trade-dialog-title">Confirm Trade</h2>

      <p id="trade-dialog-desc">
        Review the trade details below. Clicking "Send Offer" will send this
        proposal to {tradeDetails.leagueMate}.
      </p>

      <section aria-label="Trade details">
        <div>
          <h3>You give</h3>
          <ul>
            {tradeDetails.giving.map((player) => (
              <li key={player}>{player}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>You receive</h3>
          <ul>
            {tradeDetails.receiving.map((player) => (
              <li key={player}>{player}</li>
            ))}
          </ul>
        </div>
      </section>

      <div>
        {/* autofocus goes on the primary action so screen reader users
            land on the most important control first */}
        <button onClick={onConfirm} autoFocus>
          Send Offer
        </button>
        <button onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
```

### Trigger button (the "Propose Trade" button)

```tsx
function TradePanel() {
  const [modalOpen, setModalOpen] = useState(false);
  const proposeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={proposeButtonRef}
        onClick={() => setModalOpen(true)}
      >
        Propose Trade
      </button>

      <ConfirmTradeModal
        isOpen={modalOpen}
        tradeDetails={tradeDetails}
        onConfirm={handleConfirm}
        onCancel={() => setModalOpen(false)}
        triggerRef={proposeButtonRef}
      />
    </>
  );
}
```

---

## Why each decision was made

### `<dialog>` with `.showModal()`

`showModal()` (not `.show()`) opens the dialog as a true modal. The browser:
- Creates a top-layer context so the dialog sits above all other content
- Traps focus inside automatically (no manual focus trap loop needed)
- Fires a `cancel` event on Escape

This eliminates the need to write a manual focus trap. If you used `.show()` or just rendered the element without calling either method, you'd get no focus trapping and would need to implement it yourself (see the focus trap snippet in the keyboard reference).

### `aria-labelledby` + `aria-describedby`

- `aria-labelledby="trade-dialog-title"` points at the `<h2>`. Screen readers announce this as the dialog's name when focus enters: "Confirm Trade, dialog."
- `aria-describedby="trade-dialog-desc"` provides the supplementary description. Screen readers read it after the title, giving context without requiring the user to navigate into the content first.
- Use `aria-labelledby` (not `aria-label`) because the text is already visible on screen — referencing it is semantically cleaner and keeps the label in sync automatically if the heading text changes.

### `aria-modal="true"`

Even with the native `<dialog>` element, `aria-modal="true"` is needed to tell screen readers that content outside the dialog is inert. Without it, some screen readers (particularly older NVDA + Firefox combinations) let users wander out of the dialog using virtual cursor navigation (arrow keys / browse mode), bypassing the visual modal completely.

### `autoFocus` on "Send Offer"

The ARIA Authoring Practices Guide recommends moving focus to the first focusable element inside the dialog. "Send Offer" is the primary action and the first interactive element, so placing `autoFocus` there is correct. This also means the screen reader immediately announces the button, confirming to the user that the dialog has opened.

An alternative: move focus to the `<dialog>` element itself (by adding `tabindex="-1"` to it and calling `.focus()` on the ref). This makes the screen reader announce the dialog title and description before any button, which can be useful when the trade details are complex and you want the user to absorb them before being prompted to act. Either approach is valid; `autoFocus` on the button is the more common pattern.

### Focus return on close

Both "Send Offer" and "Cancel" ultimately call `onCancel` or `onConfirm`, which set `isOpen` to false. The `useEffect` watching `isOpen` then fires `triggerRef.current?.focus()`. This returns focus to the "Propose Trade" button, exactly where the user was before the dialog opened. Without this, focus lands on `<body>` and keyboard users lose their place in the page.

### Escape key handling

The native `<dialog>` fires a `cancel` event on Escape. We intercept it with `e.preventDefault()` and call `onCancel()` instead. This keeps React state authoritative — without `preventDefault`, the browser would close the native dialog directly, leaving `isOpen` as `true` and causing a stale state mismatch.

---

## What NOT to do

**Do not implement a manual focus trap if you're using `showModal()`.**  
The browser already traps focus. Adding your own `keydown` listener on top creates duplicate behavior and can cause bugs (e.g., double-trapping, preventing legitimate Tab behavior inside the modal).

**Do not use `<div role="dialog">` unless you have a hard browser-support constraint.**  
You'd need to: add `aria-modal="true"`, manage focus on open and close yourself, write a focus trap, handle Escape manually, and add `inert` or `aria-hidden` to everything outside the dialog. The `<dialog>` element does all of this with two lines.

**Do not use `aria-label` when visible text already exists.**  
`aria-label` creates a disconnect between what's visible and what's announced. If the heading text ever changes, `aria-label` silently becomes stale. Use `aria-labelledby` pointing at the visible heading instead.

**Do not put `autoFocus` on "Cancel".**  
Defaulting focus to the destructive or dismissive action means a distracted user pressing Enter or Space immediately cancels. Put `autoFocus` on the primary/safe action.

---

## WCAG criteria covered

| Criterion | How it's met |
|---|---|
| 1.3.1 Info and Relationships | `<dialog>`, `<h2>`, `<h3>`, `<ul>` convey structure semantically |
| 2.1.1 Keyboard | All controls reachable and operable by keyboard; Escape closes |
| 2.1.2 No Keyboard Trap | Focus is intentionally trapped while modal is open (the spec allows this); Escape provides the exit |
| 2.4.3 Focus Order | Focus enters the dialog on open, is trapped inside, returns to trigger on close |
| 4.1.2 Name, Role, Value | `aria-labelledby`, `aria-describedby`, `aria-modal` fully describe the dialog; buttons are native `<button>` elements |
