# Discovery / debugging method

The runtime API can't be trusted from memory — category names throw when wrong, accessors are
oddly named, raid markers are on events, etc. Always confirm against a real report by returning a
`JsonTree` and reading the output. `examples/debug-probe.js` is a ready-to-paste build.

## Rules

- **Run on a report that contains the target events.** Player deaths → a wipe/progression pull; a
  battle-res → a pull where someone was rezzed; the boss mechanic you care about must actually
  happen in the selected fight.
- **Never crash the build.** Wrap every `eventsByCategoryAndDisposition` call in try/catch — an
  invalid category throws `IllegalArgumentException` and would blank the whole component.
- **Dump keys, not assumptions.** `Object.keys(sampleEvent)` and a full sample object beat guessing
  field names.
- Iterate: one probe answers a few questions, then narrow.

## Technique 1 — crash-safe category prober

Find which category strings are valid and what they contain:

```js
function tryCat(cat, disp) {
  try {
    const r = fight.eventsByCategoryAndDisposition(cat, disp);
    if (r == null) return 'undefined/null';
    return { count: r.length, types: [...new Set(r.map(e => e.type))],
      abilities: [...new Set(r.map(e => e.ability && e.ability.name))].slice(0, 25) };
  } catch (e) { return 'threw: ' + (e && e.message ? e.message : String(e)); }
}
// probe candidates × ['enemy','friendly']
```

## Technique 2 — sample-event / actor dumper

```js
const sample = someEvents[0] || null;
return { component: 'JsonTree', props: { data: {
  count: someEvents.length,
  sample,                               // full object
  sampleKeys: sample ? Object.keys(sample) : [],
  sourceActor: sample && sample.source, // inspect actor fields incl. subType, instanceId
} } };
```

## Technique 3 — fight-member introspection

When an accessor's name is unknown (deaths, resurrects, markers), enumerate the object:

```js
const names = new Set(); let o = fight;
for (let d = 0; d < 5 && o; d++) { Object.getOwnPropertyNames(o).forEach(n => names.add(n)); o = Object.getPrototypeOf(o); }
const interesting = [...names].filter(n => /death|die|res|revi|event|summon|marker|player|actor/i.test(n));
```

This is how `friendlyPlayerDeathEvents`, `enemyDeathEvents`, `allEvents`, and `worldMarkers` were
found.

## Technique 4 — finding event types with no category

Some types (e.g. `resurrect`) have no category. Enumerate distinct types across `fight.allEvents`:

```js
const counts = {};
(fight.allEvents || []).forEach(e => counts[e.type] = (counts[e.type] || 0) + 1);
// look for 'resurrect', 'death', etc. — then filter allEvents by that type
```

Watch out for regex false positives — `/res/` matches `resourcechange`; match the exact `type`.

## What this session learned (so you don't re-probe)

- Valid categories: `casts, interrupts, aurasGained, damage, healing, dispels, summons, threat`.
- Interrupts only under `"friendly"`; interrupted spell = `stoppedAbility`.
- Raid markers on events (`sourceRaidMarker`/`targetRaidMarker`), not actors; same-name adds share
  `id`/`instanceId`.
- Deaths: `fight.friendlyPlayerDeathEvents`. Resurrects: `fight.allEvents` filtered to
  `type === "resurrect"`.
- `<Icon>` has no raid-marker types; Table has no row background and no data-row colspan.

See `references/api.md` and `references/rendering.md` for the full writeups.
