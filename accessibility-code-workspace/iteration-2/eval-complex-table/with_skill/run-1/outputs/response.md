# Accessible Dynasty Stats Table

## Pillars that apply

This task touches two pillars:

- **ARIA** — table labeling (`<caption>`, `scope` on headers, `aria-label` for the bye week cell)
- **AT Compatibility** — screen reader traversal of a large multi-column data table

---

## The right approach: native HTML `<table>`

Use a plain `<table>` with `<caption>`, `<thead>`, `<tbody>`, and `<th scope="...">`. No ARIA roles needed — the native table element maps directly to the `table` accessibility role and gives screen readers column/row header association for free.

---

## WCAG criterion

**1.3.1 Info and Relationships (Level A)** — information conveyed through visual structure (the table layout) must be programmatically determinable. For data tables this means: a `<caption>` (or `aria-labelledby`), and `<th>` elements with `scope` to associate headers with data cells.

---

## Complete markup

```html
<table>
  <caption>
    Weekly fantasy scoring for your dynasty roster, Weeks 1–17.
    Season Total is the sum of all weeks played.
  </caption>

  <thead>
    <tr>
      <!-- Top-left corner cell: no content needed, but give it scope="col" so
           it doesn't confuse screen readers. An empty <th> is fine here. -->
      <th scope="col">Player</th>
      <th scope="col">Wk 1</th>
      <th scope="col">Wk 2</th>
      <th scope="col">Wk 3</th>
      <th scope="col">Wk 4</th>
      <th scope="col">Wk 5</th>
      <th scope="col">Wk 6</th>
      <th scope="col">Wk 7</th>
      <th scope="col">Wk 8</th>
      <th scope="col">Wk 9</th>
      <th scope="col">Wk 10</th>
      <th scope="col">Wk 11</th>
      <th scope="col">Wk 12</th>
      <th scope="col">Wk 13</th>
      <th scope="col">Wk 14</th>
      <th scope="col">Wk 15</th>
      <th scope="col">Wk 16</th>
      <th scope="col">Wk 17</th>
      <th scope="col">Season Total</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <!-- Row header: player name -->
      <th scope="row">Justin Jefferson</th>
      <td>28.4</td>
      <td>19.2</td>
      <!-- Bye week: render the dash but give screen readers the word "bye" -->
      <td>
        <span aria-hidden="true">—</span>
        <span class="sr-only">bye</span>
      </td>
      <td>32.1</td>
      <!-- ... remaining weeks ... -->
      <td>312.7</td>
    </tr>

    <tr>
      <th scope="row">CeeDee Lamb</th>
      <td>14.6</td>
      <!-- ... -->
      <td>
        <span aria-hidden="true">—</span>
        <span class="sr-only">bye</span>
      </td>
      <!-- ... -->
      <td>287.3</td>
    </tr>

    <!-- Repeat for every player on your roster -->
  </tbody>
</table>
```

```css
/* Visually hidden utility — used for the bye week label above */
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

---

## Key decisions explained

### `<caption>` vs. `aria-label`

Use `<caption>`. It is native HTML, visible by default (you can style it), and is read by every screen reader without exception. `aria-label` on `<table>` is valid but hides the label from sighted users unless you add separate visible text — extra work for no benefit.

### `scope="col"` and `scope="row"`

Every `<th>` needs a `scope` attribute:
- `scope="col"` on week headers in `<thead>` — tells the AT "this header applies to the column below me"
- `scope="row"` on player name cells in `<tbody>` — tells the AT "this header applies to the row beside me"

Without `scope`, screen readers have to guess the association. NVDA and JAWS will usually figure out simple tables, but VoiceOver on iOS is stricter and will silently drop header announcements on ambiguous tables.

### The bye week `—` character

A raw em dash (`—`) will be announced as "dash" or "em dash" depending on the screen reader and its verbosity settings. Neither is meaningful in context. The correct pattern is:

```html
<td>
  <span aria-hidden="true">—</span>
  <span class="sr-only">bye</span>
</td>
```

This hides the visual dash from AT and substitutes the word "bye". A user navigating with NVDA will hear "CeeDee Lamb, Week 9, bye" — which is exactly what the cell means.

### Do NOT use `role="grid"` here

`role="grid"` is for *interactive* grids where cells are individually focusable and editable (think a spreadsheet). A read-only stats table is a `table`, not a grid. Using `role="grid"` would require you to implement full arrow-key navigation with `tabindex` management — unnecessary complexity, and it breaks the simpler reading experience screen reader users expect from a data table.

### `<thead>` and `<tbody>` are not optional

Structurally they are optional HTML, but they provide a meaningful hook for screen readers (especially VoiceOver on iOS) to identify repeating column headers when the user scrolls through a long table. Always include them.

---

## Screen reader experience (what the user will hear)

With this markup, a NVDA user navigating by cell will hear:

> "Justin Jefferson, Week 1, 28.4"  
> "Justin Jefferson, Week 3, bye"  
> "Justin Jefferson, Season Total, 312.7"

The player name is re-announced per cell because `scope="row"` makes `<th scope="row">` a header for every `<td>` in that row — exactly the right behavior for a table this wide.

---

## Testing checklist for this table

- [ ] Tab to the table, then use arrow keys in NVDA (browse mode) — confirm column and row headers are announced per cell
- [ ] VoiceOver + Safari on macOS: VO+Right through a row — player name should prefix each score
- [ ] VoiceOver on iOS: swipe through cells — same check
- [ ] Confirm bye week cells say "bye" not "dash" or "em dash"
- [ ] Run axe DevTools — a well-formed table like this should be clean
