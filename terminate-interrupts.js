// Termination Matrix — "Terminate" interrupt tracker
// Midnight Falls Mythic (encounterId 3183).
//
// Lists every "Terminate" cast from the "Termination Matrix" adds and, per add (identified by
// its raid mark), shows whether each cast was interrupted (and by whom) or went through.
//
// Notes from log inspection:
//   - Adds all share actor id/instanceId, so they are distinguished by their RAID MARKER, which
//     is carried on the event (sourceRaidMarker on casts, targetRaidMarker on interrupts).
//   - Each Terminate attempt is a "begincast"; a completed cast is a "cast"; an interrupted one
//     has an "interrupt" event in between. Interrupts live under ("interrupts", "friendly")
//     (filtered by the interrupting player) and expose the interrupted spell as `stoppedAbility`.
getComponent = () => {
  const bossEncounterId = 3183;
  const TERMINATE_ID = 1284934;
  const ADD_NAME = "Termination Matrix";
  // Each wave of 3 adds spawns when the boss casts this ability; used to number the waves.
  const SPAWN_ABILITY = "Termination Prism";
  // Show at most this many player deaths per pull (earliest first) — keeps wipes from flooding
  // the table.
  const MAX_DEATHS_PER_PULL = 5;
  // Max time from a cast's start to a valid interrupt. Terminate's cast time is ~2s; 3s leaves a
  // safety margin while staying well below the gap to the next cast of the same add.
  const MAX_CAST_MS = 3000;

  // Guard: only run when every fight in the group is this encounter (mirrors the reference component).
  const isBoss = reportGroup.fights.every(fight => fight.encounterId === bossEncounterId);
  if (!isBoss) {
    return {
      component: 'EnhancedMarkdown',
      props: {
        content: `This component only works for <EncounterIcon id="${bossEncounterId}">Midnight Falls (Mythic)</EncounterIcon>.`
      }
    };
  }

  // Pull number = this fight's position among ALL boss pulls in the report (1-based), so it's
  // correct even when reportGroup.fights is filtered to a subset.
  const bossFights = reportGroup.allFights.filter(f => f.encounterId === bossEncounterId);
  const firstFightId = bossFights[0].id;
  const pullNumber = fight => (fight.id + 1) - firstFightId;

  // Blizzard raid-marker order (1-indexed), as Unicode glyphs that approximate the in-game
  // markers. 0 = no marker. (Enhanced Markdown has no raid-marker tag and report components
  // can't render images, so glyphs are the reliable way to show the mark itself.)
  // Diamond/Triangle have no purple/green emoji, so color plain glyphs with WoW spell-school
  // styles (Shadow = purple, Nature = green).
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
  // Sort key so Unmarked (0) sorts before the 8 real markers (top of the list).
  const markerSortKey = m => (m >= 1 && m <= 8) ? m : -1;

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

    // Wave boundaries: the boss casting SPAWN_ABILITY starts each wave of 3 adds.
    let spawnEvents = enemyCasts.filter(e =>
      e.type === "cast"
      && e.ability && e.ability.name === SPAWN_ABILITY
      && e.source && e.source.name !== ADD_NAME);
    if (spawnEvents.length === 0) {
      spawnEvents = enemyCasts.filter(e =>
        e.type === "begincast"
        && e.ability && e.ability.name === SPAWN_ABILITY
        && e.source && e.source.name !== ADD_NAME);
    }
    const spawnTimes = spawnEvents.map(e => e.timestamp).sort((a, b) => a - b);
    // Wave number for a cast: 1 + how many spawns happened at/before it (min 1, so casts before
    // the first spawn still land in wave 1).
    const waveForCast = ts =>
      Math.max(1, spawnTimes.filter(t => t <= ts).length);

    // Each Terminate attempt = one begincast from a Termination Matrix add.
    let attempts = enemyCasts.filter(e =>
      e.type === "begincast"
      && e.ability && e.ability.id === TERMINATE_ID
      && e.source && e.source.name === ADD_NAME);

    // Fallback: if begincast isn't logged, use cast events as the attempt unit.
    if (attempts.length === 0) {
      attempts = enemyCasts.filter(e =>
        e.type === "cast"
        && e.ability && e.ability.id === TERMINATE_ID
        && e.source && e.source.name === ADD_NAME);
    }

    // Interrupts that stopped a Terminate on a Termination Matrix add.
    let interrupts = friendlyInterrupts
      .filter(e =>
        e.stoppedAbility && e.stoppedAbility.id === TERMINATE_ID
        && e.target && e.target.name === ADD_NAME)
      .map(e => ({ event: e, consumed: false }))
      .sort((a, b) => a.event.timestamp - b.event.timestamp);

    attempts
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((cast) => {
        const marker = cast.sourceRaidMarker;
        // First unconsumed interrupt on the same raid marker, within the cast window.
        const match = interrupts.find(i =>
          !i.consumed
          && i.event.targetRaidMarker === marker
          && i.event.timestamp >= cast.timestamp
          && i.event.timestamp <= cast.timestamp + MAX_CAST_MS);
        if (match) match.consumed = true;

        const wave = waveForCast(cast.timestamp);
        rows.push({
          _pull: fight.id,
          _wave: wave,
          _kind: 0, // casts sort before event rows within a wave
          _marker: markerSortKey(marker),
          _timestamp: cast.timestamp,
          wave: String(wave),
          fight: pullNumber(fight),
          raidMark: markerLabel(marker),
          castTime: formatTimestamp(cast.timestamp, fight.startTime),
          interruptedBy: match ? formatPlayer(match.event.source) : 'Not interrupted',
        });
      });

    // Death & battle-res event rows, bundled into the wave they fall in. We only show events up
    // to the last mapped Terminate cast in this fight.
    const maxCastTs = attempts.length ? Math.max(...attempts.map(a => a.timestamp)) : null;
    if (maxCastTs != null) {
      const pushEvent = (ts, text) => {
        const wave = waveForCast(ts);
        rows.push({
          _pull: fight.id,
          _wave: wave,
          _kind: 1, // event rows sort after the wave's cast rows
          _marker: 0,
          _timestamp: ts,
          wave: String(wave),
          fight: pullNumber(fight),
          raidMark: '',
          castTime: formatTimestamp(ts, fight.startTime),
          interruptedBy: text,
        });
      };

      // Player deaths (red text), earliest first, capped at MAX_DEATHS_PER_PULL.
      (fight.friendlyPlayerDeathEvents || [])
        .filter(d => d.target && d.timestamp <= maxCastTs)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, MAX_DEATHS_PER_PULL)
        .forEach(d => pushEvent(d.timestamp, `<Styled type="Wipe">${d.target.name} died</Styled>`));

      // Battle resurrections (green text): a "resurrect" event during the fight. No dedicated
      // accessor, so filter all events; the resurrected player is the event target.
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

  // Group by pull, then wave, then cast rows before event rows, then raid mark, then time.
  rows.sort((a, b) =>
    a._pull - b._pull
    || a._wave - b._wave
    || a._kind - b._kind
    || a._marker - b._marker
    || a._timestamp - b._timestamp);
  rows = rows.map(({ _pull, _wave, _kind, _marker, _timestamp, ...row }) => row);

  // Insert a divider row before each pull's block. The Table can't span columns on data rows, so
  // the "Pull X" label sits in the first cell with the rest blank.
  const withDividers = [];
  let currentPull = null;
  rows.forEach((row) => {
    if (row.fight !== currentPull) {
      currentPull = row.fight;
      withDividers.push({
        fight: `<Styled type="Primary">Pull ${currentPull}</Styled>`,
        wave: '',
        raidMark: '',
        castTime: '',
        interruptedBy: '',
      });
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
