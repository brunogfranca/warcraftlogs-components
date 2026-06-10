# warcraftlogs-components

[Warcraftlogs](https://www.warcraftlogs.com/) / [Archon](https://www.archon.gg/) **report
components** — small `getComponent` scripts you paste into the report-component editor to analyze a
boss pull and render the result as a table or chart.

See Archon's intro: [What are report components?](https://www.archon.gg/wow/articles/help/what-are-report-components)

## Components

Each component lives in its own folder.

### `terminate-interrupts/`

For **Midnight Falls (Mythic)** — `encounterId 3183`.

Tracks every **Terminate** cast from the **Termination Matrix** adds and shows, per add, whether
each cast was interrupted (and by whom) or went through. Output is a table grouped by **pull →
wave → raid mark**, and it also folds in **player deaths** (red) and **battle-resurrections**
(green) for each wave.

Features:
- Only runs on encounter 3183 (otherwise shows a guard message).
- Identifies each add by its **raid marker** (the adds share one actor id, so the marker is the
  only per-add identifier) and renders it as a colored glyph.
- Numbers **waves** from the boss's spawn cast and **pulls** from `reportGroup.allFights`.
- Per-pull divider rows and a titled header.
- Tunable constants at the top: `MAX_DEATHS_PER_PULL`, `MAX_CAST_MS`, `SPAWN_ABILITY`, …

**Usage:** open a Midnight Falls Mythic report on Archon/Warcraftlogs, create a new report
component, paste the contents of `terminate-interrupts/terminate-interrupts.js`, and run.

#### `terminate-interrupts/terminate-interrupts.debug.js`

A throwaway **discovery build** that returns a `JsonTree`. The Archon/WCL runtime API is largely
undocumented, so this probes event categories, dumps sample event/actor shapes, and introspects
the `fight` object to confirm field names before building the real component.

## Building more components

`.claude/skills/warcraftlogs-components/` is a [Claude Code](https://claude.com/claude-code) skill
that captures everything learned building these components — the undocumented runtime API, the
discover-then-build workflow, reusable code patterns, a worked example, and a debug-probe template.
When working in this repo with Claude Code, it activates automatically; you can also read it
directly:

- `references/api.md` — events, actors, `fight` accessors, raid markers, deaths/resurrects.
- `references/rendering.md` — `Table` / `EnhancedMarkdown` capabilities, limits, and styling.
- `references/patterns.md` — copy-ready snippets.
- `references/debugging.md` — the discovery toolkit.
- `examples/` and `assets/component-template.js` — starting points.
