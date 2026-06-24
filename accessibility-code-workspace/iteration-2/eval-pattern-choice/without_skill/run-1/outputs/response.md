# Accessibility Pattern Choice: Team Switcher Navigation

## Recommendation: Use a Menu (role=menu)

For a flat list of 3–5 team names that navigate to a team's page when selected, **a menu (`role=menu` with `role=menuitem` children) is the correct ARIA pattern**.

---

## Why Not a Dialog?

A dialog (`role=dialog`) is designed for content that requires the user's attention and interaction before returning to the main page — things like confirmations, forms, or complex multi-step flows. It:

- Traps focus inside itself until dismissed
- Implies a heavier interaction model (modal interruption)
- Requires explicit close actions
- Is semantically wrong for a simple navigation list

A flat list of navigation links is not a dialog-level interaction. Using a dialog here would confuse screen reader users who expect dialogs to require a decision before proceeding.

---

## Why Not a Combobox?

A combobox (`role=combobox`) is an input control — it combines a text field with a listbox and is used for **filtering or selecting a value to populate a field**. It:

- Implies the user is entering or filtering text
- Is associated with form input semantics
- Announces itself as an editable field to screen readers
- Is the right pattern for things like a search-with-suggestions or a select-replacement

Since clicking a team name should **navigate to a page** (not set a field value), a combobox is semantically wrong. Screen reader users would hear "combobox" and expect to type something — not navigate.

---

## Why a Menu Is Correct

The `role=menu` pattern fits because:

1. **Semantic accuracy**: A menu is a widget that offers a list of choices or actions triggered by a button. Your team switcher is exactly this — a button (the team name) that reveals a list of actions (switch to a team).

2. **Navigation actions**: `role=menuitem` items represent actions, which maps cleanly to "navigate to this team's page." (If the items were links rather than JS-triggered navigation, `role=menuitem` with an underlying `<a>` tag is still appropriate.)

3. **Expected keyboard behavior**: The menu pattern has well-defined keyboard interactions that screen reader users know:
   - `Enter` or `Space` on the trigger button opens the menu
   - `Arrow Up` / `Arrow Down` move between items
   - `Enter` activates the focused item
   - `Escape` closes the menu and returns focus to the trigger button
   - `Home` / `End` jump to first/last item

4. **Screen reader announcements**: Assistive technologies announce the trigger as a button with a popup (`aria-haspopup="menu"`), and announce the container as a menu with the number of items. This gives users an accurate mental model before they open it.

---

## Implementation Sketch

```html
<button
  id="team-switcher-btn"
  aria-haspopup="menu"
  aria-expanded="false"
  aria-controls="team-switcher-menu"
>
  Thunderhawks <!-- current team name -->
</button>

<ul
  id="team-switcher-menu"
  role="menu"
  aria-labelledby="team-switcher-btn"
  hidden
>
  <li role="none">
    <a href="/teams/thunderhawks" role="menuitem">Thunderhawks</a>
  </li>
  <li role="none">
    <a href="/teams/iron-wolves" role="menuitem">Iron Wolves</a>
  </li>
  <li role="none">
    <a href="/teams/sky-raiders" role="menuitem">Sky Raiders</a>
  </li>
</ul>
```

Key points:
- The `<button>` gets `aria-haspopup="menu"` and `aria-expanded` toggled on open/close.
- The list uses `role="menu"` and is labelled by the trigger button.
- Each `<li>` uses `role="none"` to neutralize the implicit list-item role so it doesn't interfere.
- Each link gets `role="menuitem"`.
- Focus management: when the menu opens, focus moves to the first item. When it closes (via Escape or selection), focus returns to the trigger button.
- Use `hidden` or `display: none` (not just `visibility: hidden`) to hide the menu so it is fully removed from the accessibility tree when closed.

---

## Summary

| Pattern | Verdict | Reason |
|---|---|---|
| `role=dialog` | No | Wrong semantics; implies modal interruption and required decision |
| `role=combobox` | No | Wrong semantics; implies text input and value selection for a form field |
| `role=menu` | Yes | Correct semantics for a button-triggered list of actions/navigation choices |

Use `role=menu` with `role=menuitem` children, proper `aria-haspopup`, `aria-expanded`, and keyboard focus management. This gives screen reader users accurate context, follows established interaction patterns they already know, and matches the actual behavior of the control.
