# Accessible Weekly Scoring Stats Table

## Overview

A weekly scoring table for a dynasty fantasy app is a classic **data table** — rows represent players, columns represent weeks plus a season total. Marking it up correctly with HTML table semantics gives screen reader users the ability to understand cell context (which player, which week) no matter where they navigate in the table.

---

## Key Accessibility Requirements

1. Use a `<table>` element (not CSS grid or divs) so the browser exposes grid semantics to assistive technology.
2. Provide a `<caption>` as the first child of `<table>` to give the table a programmatic label.
3. Use `<th>` for all header cells with the correct `scope` attribute.
4. Use `<thead>`, `<tbody>`, and optionally `<tfoot>` to group rows semantically.
5. Handle the bye-week cell ("—") so its meaning is clear to screen reader users.
6. Consider a `<colgroup>` or visual styling to highlight the totals column, but this is cosmetic and does not affect accessibility semantics.

---

## Complete Marked-Up Example

```html
<table>
  <caption>
    Weekly fantasy scoring for your dynasty roster — 2024 regular season (Weeks 1–17).
    A dash (—) indicates a bye week.
  </caption>

  <thead>
    <tr>
      <th scope="col">Player</th>
      <th scope="col">Wk 1</th>
      <th scope="col">Wk 2</th>
      <th scope="col">Wk 3</th>
      <!-- … repeat through Week 17 … -->
      <th scope="col">Wk 17</th>
      <th scope="col">Season Total</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <th scope="row">Patrick Mahomes</th>
      <td>28.4</td>
      <td>31.2</td>
      <td>
        <!-- Bye week: visible dash, screen-reader-friendly text -->
        <span aria-hidden="true">—</span>
        <span class="sr-only">bye</span>
      </td>
      <!-- … remaining weeks … -->
      <td>382.6</td>
    </tr>

    <tr>
      <th scope="row">Justin Jefferson</th>
      <td>18.7</td>
      <td>
        <span aria-hidden="true">—</span>
        <span class="sr-only">bye</span>
      </td>
      <td>22.1</td>
      <!-- … remaining weeks … -->
      <td>298.4</td>
    </tr>

    <!-- … additional player rows … -->
  </tbody>

  <!-- Optional: repeat the column headers in a tfoot for long tables -->
  <tfoot>
    <tr>
      <th scope="col">Player</th>
      <th scope="col">Wk 1</th>
      <!-- … -->
      <th scope="col">Wk 17</th>
      <th scope="col">Season Total</th>
    </tr>
  </tfoot>
</table>
```

---

## Explanation of Each Decision

### `<caption>`

- Must be the **first child** of `<table>`.
- Announced by screen readers before any cell content.
- Describe what the table shows and mention the bye-week convention here so users know what "—" means before they encounter it.
- Keep it concise but complete; if you have a visible heading above the table (e.g., an `<h2>`), you can use `aria-labelledby` on the `<table>` pointing to that heading instead of `<caption>`, but `<caption>` is the simpler and more universally supported approach.

### `scope="col"` on column headers

- Every `<th>` in `<thead>` needs `scope="col"` so screen readers announce "Week 3, Patrick Mahomes, bye" (or equivalent) rather than just reading a bare number.
- Without `scope`, some screen readers (especially older JAWS/NVDA combinations) will not associate the header with the data cell.

### `scope="row"` on player name headers

- The first cell in each `<tbody>` row is the player name. Using `<th scope="row">` (not `<td>`) marks it as the row header.
- This is the key distinction between a **layout table** and a **data table**: row headers let screen readers say "Patrick Mahomes — Week 3 — bye" when the user navigates to that cell.

### Bye-week cells

Using a bare em dash "—" is ambiguous to screen readers; some will read it as "dash" or skip it silently. Two good patterns:

**Option A — visually hidden text (recommended):**
```html
<td>
  <span aria-hidden="true">—</span>
  <span class="sr-only">bye</span>
</td>
```
The CSS for `.sr-only` (also called `.visually-hidden`) positions the text off-screen:
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

**Option B — `aria-label` on the cell:**
```html
<td aria-label="bye">
  <span aria-hidden="true">—</span>
</td>
```
`aria-label` on `<td>` overrides the cell's accessible name entirely. This is clean but less flexible if you later want to add tooltip content inside the cell.

Both options work well. Option A is slightly more portable across screen reader/browser combinations.

### `<thead>` and `<tbody>`

- Grouping rows in `<thead>` signals that these are header rows, not data rows. Some screen readers use this grouping to decide when to repeat header announcements.
- `<tbody>` is technically implied by the parser but it is best practice to write it explicitly for clarity and for CSS targeting.

### `<tfoot>` (optional)

- For a 17-column table, users who scroll or navigate to the bottom may lose visual context of which column is which. Repeating the header row in `<tfoot>` with `scope="col"` provides the same semantic anchoring at the bottom.
- Not required for accessibility compliance, but helpful for long tables.

---

## What NOT to Do

| Anti-pattern | Why it fails |
|---|---|
| Use `<div>` and `<span>` for a data grid without ARIA | Screen readers see no table structure; navigation by row/column is impossible |
| Omit `scope` on `<th>` elements | Headers are not associated with data cells in many screen readers |
| Use `<td>` for player names instead of `<th scope="row">` | Row context is lost; user just hears raw numbers |
| Put "—" with no alternative text and no caption explanation | Screen reader reads "dash" or nothing; user cannot tell it is a bye |
| Skip `<caption>` and rely on a nearby heading | The heading is not programmatically linked to the table in all AT combinations |
| Use `aria-label` on `<table>` AND `<caption>` together | They conflict; pick one labelling mechanism |

---

## WCAG Success Criteria Addressed

- **1.3.1 Info and Relationships (Level A):** Structural relationships (row/column headers, data cells) are conveyed through `<th>`, `scope`, `<thead>`, and `<tbody>`.
- **1.4.5 Images of Text (Level AA):** Not applicable here since all content is real text.
- **4.1.2 Name, Role, Value (Level A):** The table caption provides the accessible name; each cell's role (columnheader, rowheader, gridcell) is exposed natively by HTML semantics.

---

## Summary Checklist

- [ ] `<table>` element used (not a CSS-grid div layout)
- [ ] `<caption>` is first child of `<table>`, explains purpose and bye-week convention
- [ ] All week-column and totals-column headers use `<th scope="col">`
- [ ] Each player name cell uses `<th scope="row">`
- [ ] Rows grouped with `<thead>` and `<tbody>`
- [ ] Bye-week cells use `<span aria-hidden="true">—</span><span class="sr-only">bye</span>` (or equivalent)
- [ ] `.sr-only` CSS class defined and tested
- [ ] Table tested with at least NVDA + Firefox and VoiceOver + Safari
