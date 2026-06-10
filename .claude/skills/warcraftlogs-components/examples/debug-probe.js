// PASTE-READY DISCOVERY BUILD. Edit the candidate lists / names for your encounter, paste into the
// Archon/WCL report-component editor, and read the JsonTree output. Crash-safe: invalid categories
// are caught, not thrown. Run on a report that actually contains the events you're after.
getComponent = () => {
  const bossEncounterId = 0; // TODO: your encounterId

  const fight = reportGroup.fights.find(f => f.encounterId === bossEncounterId)
    || reportGroup.fights[0];

  // 1) Which category strings are valid, and what's inside them.
  function tryCat(cat, disp) {
    try {
      const r = fight.eventsByCategoryAndDisposition(cat, disp);
      if (r == null) return 'undefined/null';
      return {
        count: r.length,
        types: [...new Set(r.map(e => e.type))],
        abilities: [...new Set(r.map(e => e.ability && e.ability.name))].slice(0, 25),
        sources: [...new Set(r.map(e => e.source && e.source.name))].slice(0, 25),
      };
    } catch (e) { return 'threw: ' + (e && e.message ? e.message : String(e)); }
  }
  const CATEGORIES = ['casts', 'interrupts', 'aurasGained', 'damage', 'healing', 'dispels', 'summons', 'threat'];
  const probe = {};
  CATEGORIES.forEach(c => { ['enemy', 'friendly'].forEach(d => { probe[`${c} | ${d}`] = tryCat(c, d); }); });

  // 2) Enumerate fight members (find death/resurrect/marker accessors).
  const members = new Set(); let o = fight;
  for (let depth = 0; depth < 5 && o; depth++) { Object.getOwnPropertyNames(o).forEach(n => members.add(n)); o = Object.getPrototypeOf(o); }
  const interestingMembers = [...members].sort().filter(n => /death|die|res|revi|event|summon|marker|player|actor/i.test(n));

  // 3) Distinct event types across allEvents (find types with no category, e.g. "resurrect").
  const typeCounts = {};
  (fight.allEvents || []).forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });

  // 4) Sample shapes — edit the filters to grab the events you care about.
  const sampleCast = (fight.eventsByCategoryAndDisposition('casts', 'enemy') || [])[0] || null;
  const sampleDeath = (fight.friendlyPlayerDeathEvents || [])[0] || null;

  return {
    component: 'JsonTree',
    props: {
      data: {
        fightId: fight.id,
        encounterId: fight.encounterId,
        difficulty: fight.difficulty,
        probe,
        interestingMembers,
        distinctEventTypes: Object.keys(typeCounts).sort(),
        sampleCast,
        sampleCastKeys: sampleCast ? Object.keys(sampleCast) : [],
        sampleDeath,
        sampleDeathKeys: sampleDeath ? Object.keys(sampleDeath) : [],
      }
    }
  };
};
