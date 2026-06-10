# Copy-ready patterns

Snippets distilled from real components. Adjust constants per encounter.

## Top-of-file config

Keep tunables as named constants at the very top so they're easy to find/change:

```js
const bossEncounterId = 3183;
const ADD_NAME = "Termination Matrix";
const TERMINATE_ID = 1284934;     // prefer matching abilities by id over name
const SPAWN_ABILITY = "Termination Prism";
const MAX_DEATHS_PER_PULL = 5;    // cap noisy wipe deaths
const MAX_CAST_MS = 3000;         // cast→interrupt matching window
```

## Encounter guard

```js
const ok = reportGroup.fights.every(f => f.encounterId === bossEncounterId);
if (!ok) return { component: 'EnhancedMarkdown',
  props: { content: `Only works for <EncounterIcon id="${bossEncounterId}">this boss</EncounterIcon>.` } };
```

## Formatters

```js
function formatPlayer(player) {
  if (!player) return '';
  const spec = reportGroup.fights[0].specForPlayer(player);
  return `<ActorIcon type="${player.subType}-${spec}">${player.name}</ActorIcon>`;
}

function formatTimestamp(ts, fightStartTime) {
  const total = (ts - fightStartTime) / 1000;
  const m = Math.floor(total / 60);
  const s = (total % 60).toFixed(3);
  return `${m}:${s.padStart(6, '0')}`;
}
```

## Pull numbering (stable under filtering)

```js
const bossFights = reportGroup.allFights.filter(f => f.encounterId === bossEncounterId);
const firstFightId = bossFights[0].id;
const pullNumber = fight => (fight.id + 1) - firstFightId;
```

## Wave numbering from a boss spawn-cast

```js
let spawns = enemyCasts.filter(e => e.type === "cast"
  && e.ability && e.ability.name === SPAWN_ABILITY && e.source && e.source.name !== ADD_NAME);
if (!spawns.length) spawns = enemyCasts.filter(e => e.type === "begincast" /* same */);
const spawnTimes = spawns.map(e => e.timestamp).sort((a, b) => a - b);
const waveForCast = ts => Math.max(1, spawnTimes.filter(t => t <= ts).length); // before next spawn => current wave
```

## Interrupt matching (when adds are only separable by raid marker)

Each `begincast` is one attempt. Pair it with the first not-yet-consumed interrupt that shares the
raid marker and lands inside the cast window; unmatched attempts went through.

```js
let interrupts = friendlyInterrupts
  .filter(e => e.stoppedAbility && e.stoppedAbility.id === TERMINATE_ID && e.target && e.target.name === ADD_NAME)
  .map(e => ({ event: e, consumed: false }))
  .sort((a, b) => a.event.timestamp - b.event.timestamp);

attempts.sort((a, b) => a.timestamp - b.timestamp).forEach(cast => {
  const marker = cast.sourceRaidMarker;
  const match = interrupts.find(i => !i.consumed
    && i.event.targetRaidMarker === marker
    && i.event.timestamp >= cast.timestamp
    && i.event.timestamp <= cast.timestamp + MAX_CAST_MS);
  if (match) match.consumed = true;
  // match ? formatPlayer(match.event.source) : 'Not interrupted'
});
```

## Sort-key + strip pattern

Push hidden `_`-prefixed keys for sorting, then strip them before returning. Use distinct
ordering tiers (e.g. `_kind` so event rows fall after cast rows within a wave):

```js
rows.sort((a, b) =>
  a._pull - b._pull || a._wave - b._wave || a._kind - b._kind
  || a._marker - b._marker || a._timestamp - b._timestamp);
rows = rows.map(({ _pull, _wave, _kind, _marker, _timestamp, ...row }) => row);
```

## Event rows (deaths red / res green), capped, bundled per wave

```js
const maxCastTs = attempts.length ? Math.max(...attempts.map(a => a.timestamp)) : null;
if (maxCastTs != null) {
  const pushEvent = (ts, text) => rows.push({ _pull: fight.id, _wave: waveForCast(ts), _kind: 1,
    _marker: 0, _timestamp: ts, wave: String(waveForCast(ts)), fight: pullNumber(fight),
    raidMark: '', castTime: formatTimestamp(ts, fight.startTime), interruptedBy: text });

  (fight.friendlyPlayerDeathEvents || [])
    .filter(d => d.target && d.timestamp <= maxCastTs)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, MAX_DEATHS_PER_PULL)
    .forEach(d => pushEvent(d.timestamp, `<Styled type="Wipe">${d.target.name} died</Styled>`));

  (fight.allEvents || [])
    .filter(e => e.type === "resurrect" && e.timestamp <= maxCastTs)
    .forEach(e => { const p = e.target || e.source;
      pushEvent(e.timestamp, `<Styled type="Kill">${p ? p.name : 'Someone'} was resurrected</Styled>`); });
}
```

## Divider rows (fake full-width section header)

Table can't colspan data rows, so put the label in the first cell, blank the rest:

```js
const out = []; let cur = null;
rows.forEach(row => {
  if (row.fight !== cur) { cur = row.fight;
    out.push({ fight: `<Styled type="Primary">Pull ${cur}</Styled>`, wave: '', raidMark: '', castTime: '', interruptedBy: '' }); }
  out.push(row);
});
rows = out;
```
