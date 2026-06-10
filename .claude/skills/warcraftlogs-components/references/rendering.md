# Rendering: Table, EnhancedMarkdown, tags

Components return `{ component, props }`. Available components: `Table`, `EnhancedMarkdown`,
`Chart`, `JsonTree`.

## Table

```js
return {
  component: 'Table',
  props: {
    columns: {
      colKey: { header: 'Header', noWrap: false, textAlign: 'left' /* or 'center' */ },
      // ...
    },
    data: [ { colKey: 'cell value', /* ... */ }, /* one object per row */ ],
  }
};
```

- Each `data` row is an object keyed by column id; the value is the cell content (Enhanced Markdown
  allowed in every cell).
- **Header groups / title:** wrap leaf columns in a parent column that has a `columns` property.
  This is how to give the whole table a title:
  ```js
  columns: {
    title: {
      header: '<EncounterIcon id="3183">My Title</EncounterIcon>',
      columns: {
        a: { header: 'A' },
        b: { header: 'B' },
      },
    },
  }
  // data rows still key off the LEAF ids (a, b) — not the group.
  ```
- **Limits (confirmed):**
  - **No per-row background color** and **no conditional row styling.** Color is cell-level only.
  - **No colspan on data rows** — "you cannot add row data to a column that contains other
    columns", and a data value fills exactly one leaf cell. To fake a full-width divider, put the
    label in the first cell and leave the rest blank (see patterns.md → divider rows).

## EnhancedMarkdown

```js
return { component: 'EnhancedMarkdown', props: { content: `# Title\n\nMarkdown + tags here` } };
```

Markdown headings, tables, lists all work. Use for guard messages and header-per-section layouts
that a `Table` can't express.

## Tags (usable in Table cells and EnhancedMarkdown)

- `<ActorIcon type="Class-Spec">Name</ActorIcon>` — class/spec-colored player. Build with
  `subType` + `specForPlayer`.
- `<AbilityIcon id="" icon="" type="">Name</AbilityIcon>`
- `<EncounterIcon id="">Name</EncounterIcon>`
- `<Styled type="...">text</Styled>` — colored/styled text. Confirmed type values include:
  `Wipe` (red), `Kill` (green), `Primary`, class names, and spell schools
  `Fire, Nature (green), Frost, Shadow (purple), Arcane, Holy, Physical, Chaos`.
- `<Icon type="check">` — the only confirmed `<Icon>` type. **Raid-marker icon types do NOT
  exist** (`rt1`, `skull`, `raid-marker-8` … all fail). `<Image>` is removed in report components.

## Raid-marker rendering

There is no raid-marker tag and no image support, so render markers as Unicode glyphs. Emoji cover
most; for markers with no correctly-colored emoji (purple Diamond, green Triangle), color a plain
geometric glyph with `<Styled>` using a matching spell school:

```js
const RAID_MARKS = {
  1: '⭐', 2: '🟠',
  3: '<Styled type="Shadow">◆</Styled>',   // purple diamond
  4: '<Styled type="Nature">▲</Styled>',   // green triangle
  5: '🌙', 6: '🟦', 7: '❌', 8: '💀',
};
```

## JsonTree (debugging)

```js
return { component: 'JsonTree', props: { data: { /* anything */ } } };
```

Renders an explorable tree of arbitrary data. The workhorse for discovery — see
`references/debugging.md`.
