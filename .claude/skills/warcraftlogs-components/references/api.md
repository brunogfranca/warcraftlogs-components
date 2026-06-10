# Runtime data API

All facts below were confirmed empirically against real Midnight Falls Mythic reports. The Archon
help articles do NOT document most of this. When in doubt, re-confirm with a debug build
(`references/debugging.md`).

## reportGroup

- `reportGroup.fights` — the fights in the **current view** (may be filtered to a subset by the
  dashboard's phase/time/selection filters).
- `reportGroup.allFights` — every fight in the report, unfiltered. Use this for **pull numbering**
  so numbers stay correct when the view is filtered:
  ```js
  const bossFights = reportGroup.allFights.filter(f => f.encounterId === bossEncounterId);
  const firstFightId = bossFights[0].id;
  const pullNumber = fight => (fight.id + 1) - firstFightId; // 1-based, assumes consecutive ids
  ```

## fight object

Confirmed members (via prototype introspection — see debugging.md):

| Member | Use |
|---|---|
| `encounterId`, `id`, `startTime`, `endTime`, `difficulty` | identity; difficulty 5 = Mythic |
| `name`, `isKill`, `maps`, `phaseTransitions`, `phaseNames` | metadata |
| `eventsByCategoryAndDisposition(cat, disp)` | **primary, cached** event accessor |
| `allEvents`, `events` | ALL events (unfiltered) / current-view events — large; use for types with no category |
| `friendlyPlayerDeathEvents`, `enemyDeathEvents` (+ `allFriendlyPlayerDeathEvents`, `allEnemyDeathEvents`) | death events |
| `combatantInfoEvents`, `allCombatantInfoEvents` | gear/talents at pull start |
| `specForPlayer(p)`, `roleForPlayer(p)`, `itemLevelForPlayer(p)` | per-player lookups |
| `worldMarkers` | placed world markers |
| `enemyParticipants`, `friendlyParticipants`, `isEnemyParticipant`, `isFriendlyParticipant` | actor lists |
| `instanceCountForNpc`, `instanceGroupCountForNpc`, `groupNumberForActorFromTimestamp` | NPC instancing |
| `phaseForEvent`, `eventsPriorToDeath`, `damageEventsForHealingEvent`, `healingEventsForDamageEvent` | misc |

`friendlyDeathEvents` does NOT exist — the correct name is `friendlyPlayerDeathEvents`.

## eventsByCategoryAndDisposition(category, disposition)

Cached and preferred. `disposition` is `"enemy"` or `"friendly"` (`"neutral"` is treated like
enemy). The disposition filters on the **acting/source** actor for most categories — notably
interrupts are returned under `"friendly"` because the interrupter is the friendly player.

**Valid `category` strings** (any other value throws `java.lang.IllegalArgumentException`):
`casts`, `interrupts`, `aurasGained`, `damage`, `healing`, `dispels`, `summons`, `threat`.

Known-invalid (throw): `deaths`, `death`, `resurrect(s)`, `damageDone`, `damageTaken`, `buffs`,
`debuffs`, `auras`, `aurasLost`, `begincasts`, `resources`, `other`.

## Event shapes

Common top-level fields on every event:
`timestamp`, `type`, `source`, `sourceInstanceId`, `sourceDisposition`, `sourceRaidMarker`,
`target`, `targetInstanceId`, `targetDisposition`, `targetRaidMarker`, `ability`.

**Cast** (`casts`): `type` is `"begincast"` (cast START — one attempt) or `"cast"` (COMPLETED).
For an enemy cast, `source` is the casting NPC. An interrupted cast has a `begincast` and an
interrupt but no completing `cast`.

**Interrupt** (`interrupts`, `"friendly"`): `type:"interrupt"`. `ability` = the interrupt spell
(Kick/Quell/…); the **interrupted** spell is `stoppedAbility` (full object with `.id`/`.name`).
`source` = interrupter (player), `target` = the mob.

**Death** (`fight.friendlyPlayerDeathEvents`): `type:"death"`, `target` = the dead actor,
`killer`, `killingAbility`, `deathSaveAbility`/`deathSaveTime`, `isFeign`. (Enemy deaths via
`fight.enemyDeathEvents`.)

**Resurrect:** `resurrect` is a real event `type` but has **no category and no accessor** — get it
from `fight.allEvents.filter(e => e.type === "resurrect")`. `target` = resurrected player,
`source` = caster. A resurrect mid-fight is effectively a battle-res.

**Ability object:** `{ id, name, type, icon, isMelee, isOffGcd, ... }`. Prefer matching by
`ability.id` (stable) over `ability.name`.

**Actor object:** `{ id, name, idInReport, gameId, type:"Player"|"NPC"|"Pet", subType, instanceId,
icon, petOwner, isAnonymous }`. For players, `subType` is the class (e.g. `"Mage"`).

## Raid markers & NPC instancing (important)

- The raid marker is carried on the **event**, not the actor: `sourceRaidMarker` (on a cast by the
  marked NPC) and `targetRaidMarker` (on an interrupt targeting it). Value 1–8, `0` = unmarked.
- Blizzard order: `1 Star, 2 Circle, 3 Diamond, 4 Triangle, 5 Moon, 6 Square, 7 Cross, 8 Skull`.
- Multiple same-name adds frequently share the same `actor.id` AND `instanceId` — they are NOT
  separable by id. When that happens, the **raid marker is the only per-add identifier**. Match
  related events (a cast and the interrupt that stopped it) by `sourceRaidMarker === targetRaidMarker`.
- Markers can be applied a beat after spawn, so early events may show marker `0`.
