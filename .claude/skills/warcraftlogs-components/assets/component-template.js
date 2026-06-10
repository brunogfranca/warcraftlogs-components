// STARTER TEMPLATE — copy, then fill the TODOs. See the skill's references/ for the API and
// patterns, and examples/terminate-interrupts.js for a complete build. Discover field names with
// examples/debug-probe.js before trusting them.
getComponent = () => {
  const bossEncounterId = 0; // TODO: encounterId this component supports
  // TODO: add constants — ability ids/names, add names, matching windows, caps.

  // Guard: render a message instead of breaking on the wrong encounter.
  const ok = reportGroup.fights.every(f => f.encounterId === bossEncounterId);
  if (!ok) {
    return {
      component: 'EnhancedMarkdown',
      props: { content: `This component only works for <EncounterIcon id="${bossEncounterId}">this boss</EncounterIcon>.` }
    };
  }

  // Pull number among all boss pulls (1-based), stable when the view is filtered.
  const bossFights = reportGroup.allFights.filter(f => f.encounterId === bossEncounterId);
  const firstFightId = bossFights[0].id;
  const pullNumber = fight => (fight.id + 1) - firstFightId;

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

  let rows = [];
  reportGroup.fights.forEach((fight) => {
    // Valid categories: casts, interrupts (friendly only), aurasGained, damage, healing,
    // dispels, summons, threat. Deaths: fight.friendlyPlayerDeathEvents. Resurrect: filter
    // fight.allEvents for type === "resurrect".
    const casts = fight.eventsByCategoryAndDisposition('casts', 'enemy') || [];

    // TODO: build rows. Use _-prefixed keys for sorting, real keys for display.
    casts.forEach((e) => {
      // rows.push({ _pull: fight.id, _timestamp: e.timestamp,
      //   pull: pullNumber(fight), time: formatTimestamp(e.timestamp, fight.startTime), /* ... */ });
    });
  });

  if (rows.length === 0) {
    return { component: 'EnhancedMarkdown', props: { content: 'No matching events found in this report.' } };
  }

  rows.sort((a, b) => a._pull - b._pull || a._timestamp - b._timestamp);
  rows = rows.map(({ _pull, _timestamp, ...row }) => row);

  return {
    component: 'Table',
    props: {
      columns: {
        title: {
          header: `<EncounterIcon id="${bossEncounterId}">My Component Title</EncounterIcon>`,
          columns: {
            // pull: { header: 'Pull' },
            // time: { header: 'Time' },
            // TODO: leaf columns; data rows key off these ids.
          },
        },
      },
      data: rows
    }
  };
};
