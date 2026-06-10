---
name: warcraftlogs-components
description: This skill should be used when the user asks to "create a warcraftlogs component", "build an archon report component", "write a report component", "make a getComponent script", or wants to analyze a boss/encounter from a Warcraftlogs report (interrupts, deaths, casts, raid marks, waves) and render it as a Table/EnhancedMarkdown/Chart. Captures the undocumented Archon/WCL report-component runtime API, the discover-then-build workflow, reusable code patterns, and a worked example.
version: 0.1.0
---

# Warcraftlogs / Archon Report Components

A report component is a single function pasted into the Archon/WCL report-component editor:

```js
getComponent = () => {
  return { component: 'Table', props: { /* ... */ } };
};
```

It runs against a loaded report and returns one component descriptor: `Table`, `EnhancedMarkdown`,
`Chart`, or `JsonTree`. Docs: https://www.archon.gg/wow/articles/help/what-are-report-components

## The one rule that matters: discover, then build

The runtime API is **largely undocumented and partly counter-intuitive** (category names throw if
wrong, raid markers live on events not actors, deaths/resurrects need special accessors). Do not
guess field names from memory — **confirm them against a real report first**:

1. **Discover.** Write a `JsonTree` debug build that dumps the events/actors/accessors involved and
   probes category strings in try/catch. Have the user paste it into the editor and share the
   output. See `references/debugging.md` and `examples/debug-probe.js`.
2. **Build.** Implement the real component once field names are confirmed.
3. **Verify.** Cross-check rows against the report's native views (Interrupts, Deaths, Casts).

Run discovery on a report that actually contains the target events (e.g. a **wipe** to see player
deaths, a pull with a **battle-res** to see `resurrect`).

## Standard skeleton

```js
getComponent = () => {
  const bossEncounterId = 0; // TODO

  // Guard — render a message instead of breaking on the wrong encounter.
  const ok = reportGroup.fights.every(f => f.encounterId === bossEncounterId);
  if (!ok) return { component: 'EnhancedMarkdown',
    props: { content: `Only works for <EncounterIcon id="${bossEncounterId}">this boss</EncounterIcon>.` } };

  let rows = [];
  reportGroup.fights.forEach(fight => {
    const casts = fight.eventsByCategoryAndDisposition('casts', 'enemy') || [];
    // ...build rows...
  });

  return { component: 'Table', props: { columns: { /* ... */ }, data: rows } };
};
```

See `assets/component-template.js` for a fuller starter and `examples/terminate-interrupts.js` for
a complete, real component (interrupts + raid marks + waves + deaths/res + pull dividers).

## Quick reference

**`eventsByCategoryAndDisposition(category, disposition)`** — cached, preferred. Disposition is
`"enemy"` or `"friendly"`. **Valid categories only** (anything else throws
`IllegalArgumentException`):

| Works | Notes |
|---|---|
| `casts` | `begincast` (start) and `cast` (completed) event types |
| `interrupts` | only under `"friendly"` (filtered by interrupter); interrupted spell is `stoppedAbility` |
| `aurasGained` | buffs/debuffs applied/removed |
| `damage`, `healing` | |
| `dispels`, `summons`, `threat` | |

**Key `fight` accessors:** `encounterId`, `id`, `startTime`, `difficulty`, `specForPlayer(p)`,
`roleForPlayer(p)`, `friendlyPlayerDeathEvents`, `enemyDeathEvents`, `allEvents`, `worldMarkers`.
**`reportGroup`:** `fights` (current filtered view) vs `allFights` (every pull — use for pull
numbering).

**Gotchas (full detail in `references/api.md`):**
- Raid markers are on the **event** (`sourceRaidMarker`/`targetRaidMarker`, 1–8), not the actor.
- Same-name NPCs often share `id` and `instanceId` — distinguish them by raid marker.
- Deaths/resurrects are NOT valid categories; use the `fight` accessors / `allEvents`.

## Rendering (full detail in `references/rendering.md`)

- `Table`: columns + data; titles via a wrapping header group; **no row backgrounds and no
  data-row colspan**. Color text with `<Styled type="Wipe">` (red) / `<Styled type="Kill">`
  (green). Cells accept Enhanced Markdown.
- Tags available: `<ActorIcon>`, `<AbilityIcon>`, `<EncounterIcon>`, `<Styled>`,
  `<Icon type="check">` (raid-marker icon types do NOT exist — use glyphs).

## Resource index

- `references/api.md` — the runtime data API (events, actors, accessors, raid markers, deaths/res).
- `references/rendering.md` — Table & EnhancedMarkdown capabilities, limits, and styling.
- `references/patterns.md` — copy-ready snippets (guard, formatters, interrupt matching, waves,
  pull numbering, sort-and-strip, event rows, config caps).
- `references/debugging.md` — the discovery toolkit (category prober, field dumper, member
  introspection).
- `examples/terminate-interrupts.js` — full worked component.
- `examples/debug-probe.js` — paste-ready discovery build.
- `assets/component-template.js` — starter skeleton.
