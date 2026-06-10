// WORKED EXAMPLE — a complete report component.
// Midnight Falls Mythic (encounterId 3183): tracks "Terminate" casts from "Termination Matrix"
// adds, who interrupted each (or "Not interrupted"), grouped by pull → wave → raid mark, with
// player death (red) and battle-res (green) rows bundled per wave, and per-pull divider rows.
//
// Demonstrates: encounter guard, eventsByCategoryAndDisposition, begincast-vs-cast attempts,
// interrupts under "friendly" + stoppedAbility, raid markers carried on events, wave numbering
// from a boss spawn-cast, pull numbering from allFights, friendlyPlayerDeathEvents, resurrect via
// allEvents, Table title header-group, <Styled> colored text, glyph raid markers, divider rows.
getComponent = () => {
  const bossEncounterId = 3183;
  const TERMINATE_ID = 1284934;
  const ADD_NAME = "Termination Matrix";
  const SPAWN_ABILITY = "Termination Prism"; // boss cast that spawns each wave of 3 adds
  const MAX_DEATHS_PER_PULL = 5;             // earliest N deaths per pull (keeps wipes tidy)
  const MAX_CAST_MS = 3000;                  // cast→interrupt matching window (Terminate ~2s)

  const isBoss = reportGroup.fights.every(fight => fight.encounterId === bossEncounterId);
  if (!isBoss) {
    return {
      component: 'EnhancedMarkdown',
      props: {
        content: `This component only works for <EncounterIcon id="${bossEncounterId}">Midnight Falls (Mythic)</EncounterIcon>.`
      }
    };
  }

  // Pull number = position among ALL boss pulls (1-based), correct even when fights is filtered.
  const bossFights = reportGroup.allFights.filter(f => f.encounterId === bossEncounterId);
  const firstFightId = bossFights[0].id;
  const pullNumber = fight => (fight.id + 1) - firstFightId;

  // Raid markers (Blizzard order). No raid-marker tag exists and images are unsupported, so use
  // glyphs; Diamond/Triangle get the right color via <Styled> spell schools.
  const RAID_MARKS = {
    1: { glyph: '⭐', name: 'Star' },
    2: { glyph: '🟠', name: 'Circle' },
    3: { glyph: '<Styled type="Shadow">◆</Styled>', name: 'Diamond' },
    4: { glyph: '<Styled type="Nature">▲</Styled>', name: 'Triangle' },
    5: { glyph: '🌙', name: 'Moon' },
    6: { glyph: '🟦', name: 'Square' },
    7: { glyph: '❌', name: 'Cross' },
    8: { glyph: '💀', name: 'Skull' },
  };
  const markerLabel = m => RAID_MARKS[m] ? `${RAID_MARKS[m].glyph} ${RAID_MARKS[m].name}` : '— Unmarked';
  const markerSortKey = m => (m >= 1 && m <= 8) ? m : -1; // unmarked (0) sorts first

  function formatPlayer(player) {
    if (!player) return '';
    const spec = reportGroup.fights[0].specForPlayer(player);
    return `<ActorIcon type="${player.subType}-${spec}">${player.name}</ActorIcon>`;
  }

  function formatTimestamp(timestamp, fightStartTime) {
    const totalSeconds = (timestamp - fightStartTime) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(3);
    return `${minutes}:${seconds.padStart(6, '0')}`;
  }

  let rows = [];

  reportGroup.fights.forEach((fight) => {
    const enemyCasts = fight.eventsByCategoryAndDisposition("casts", "enemy") || [];
    const friendlyInterrupts = fight.eventsByCategoryAndDisposition("interrupts", "friendly") || [];

    // Wave boundaries: the boss casting SPAWN_ABILITY starts each wave.
    let spawnEvents = enemyCasts.filter(e =>
      e.type === "cast" && e.ability && e.ability.name === SPAWN_ABILITY && e.source && e.source.name !== ADD_NAME);
    if (spawnEvents.length === 0) {
      spawnEvents = enemyCasts.filter(e =>
        e.type === "begincast" && e.ability && e.ability.name === SPAWN_ABILITY && e.source && e.source.name !== ADD_NAME);
    }
    const spawnTimes = spawnEvents.map(e => e.timestamp).sort((a, b) => a - b);
    const waveForCast = ts => Math.max(1, spawnTimes.filter(t => t <= ts).length);

    // Each Terminate attempt = one begincast (fallback to cast if begincast isn't logged).
    let attempts = enemyCasts.filter(e =>
      e.type === "begincast" && e.ability && e.ability.id === TERMINATE_ID && e.source && e.source.name === ADD_NAME);
    if (attempts.length === 0) {
      attempts = enemyCasts.filter(e =>
        e.type === "cast" && e.ability && e.ability.id === TERMINATE_ID && e.source && e.source.name === ADD_NAME);
    }

    // Interrupts that stopped a Terminate on an add.
    let interrupts = friendlyInterrupts
      .filter(e => e.stoppedAbility && e.stoppedAbility.id === TERMINATE_ID && e.target && e.target.name === ADD_NAME)
      .map(e => ({ event: e, consumed: false }))
      .sort((a, b) => a.event.timestamp - b.event.timestamp);

    attempts
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((cast) => {
        const marker = cast.sourceRaidMarker;
        const match = interrupts.find(i =>
          !i.consumed
          && i.event.targetRaidMarker === marker
          && i.event.timestamp >= cast.timestamp
          && i.event.timestamp <= cast.timestamp + MAX_CAST_MS);
        if (match) match.consumed = true;

        const wave = waveForCast(cast.timestamp);
        rows.push({
          _pull: fight.id, _wave: wave, _kind: 0, _marker: markerSortKey(marker), _timestamp: cast.timestamp,
          wave: String(wave),
          fight: pullNumber(fight),
          raidMark: markerLabel(marker),
          castTime: formatTimestamp(cast.timestamp, fight.startTime),
          interruptedBy: match ? formatPlayer(match.event.source) : 'Not interrupted',
        });
      });

    // Death (red) & battle-res (green) rows, bundled per wave, only up to the last mapped cast.
    const maxCastTs = attempts.length ? Math.max(...attempts.map(a => a.timestamp)) : null;
    if (maxCastTs != null) {
      const pushEvent = (ts, text) => {
        const wave = waveForCast(ts);
        rows.push({
          _pull: fight.id, _wave: wave, _kind: 1, _marker: 0, _timestamp: ts,
          wave: String(wave), fight: pullNumber(fight), raidMark: '',
          castTime: formatTimestamp(ts, fight.startTime), interruptedBy: text,
        });
      };

      (fight.friendlyPlayerDeathEvents || [])
        .filter(d => d.target && d.timestamp <= maxCastTs)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, MAX_DEATHS_PER_PULL)
        .forEach(d => pushEvent(d.timestamp, `<Styled type="Wipe">${d.target.name} died</Styled>`));

      (fight.allEvents || [])
        .filter(e => e.type === "resurrect" && e.timestamp <= maxCastTs)
        .forEach(e => {
          const player = e.target || e.source;
          pushEvent(e.timestamp, `<Styled type="Kill">${player ? player.name : 'Someone'} was resurrected</Styled>`);
        });
    }
  });

  if (rows.length === 0) {
    return {
      component: 'EnhancedMarkdown',
      props: { content: 'No <ActorIcon>Termination Matrix</ActorIcon> "Terminate" casts found in this report.' }
    };
  }

  rows.sort((a, b) =>
    a._pull - b._pull || a._wave - b._wave || a._kind - b._kind || a._marker - b._marker || a._timestamp - b._timestamp);
  rows = rows.map(({ _pull, _wave, _kind, _marker, _timestamp, ...row }) => row);

  // Per-pull divider rows (label in first cell — Table can't colspan data rows).
  const withDividers = [];
  let currentPull = null;
  rows.forEach((row) => {
    if (row.fight !== currentPull) {
      currentPull = row.fight;
      withDividers.push({ fight: `<Styled type="Primary">Pull ${currentPull}</Styled>`, wave: '', raidMark: '', castTime: '', interruptedBy: '' });
    }
    withDividers.push(row);
  });
  rows = withDividers;

  return {
    component: 'Table',
    props: {
      columns: {
        title: {
          header: '<EncounterIcon id="3183">Termination Matrix — "Terminate" Interrupts</EncounterIcon>',
          columns: {
            fight: { header: 'Pull' },
            wave: { header: 'Wave' },
            raidMark: { header: 'Raid Mark' },
            castTime: { header: 'Cast Time' },
            interruptedBy: { header: 'Interrupted By' },
          },
        },
      },
      data: rows
    }
  };
};
