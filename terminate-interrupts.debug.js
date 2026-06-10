// STEP A3 — Confirm death accessor + find the resurrect signal.
// Run on a Midnight Falls Mythic pull where at least one player was BATTLE-REZZED if possible.
getComponent = () => {
  const bossEncounterId = 3183;
  const fight = reportGroup.fights.find(f => f.encounterId === bossEncounterId)
    || reportGroup.fights[0];

  // 1) Confirm the death accessor.
  const deaths = fight.friendlyPlayerDeathEvents || [];
  const deathInfo = {
    count: deaths.length,
    sampleKeys: deaths[0] ? Object.keys(deaths[0]) : [],
    sample: deaths[0] || null,
    list: deaths.slice(0, 12).map(e => ({
      timestamp: e.timestamp,
      player: e.target && e.target.name,
      killingAbility: e.killingAbility && e.killingAbility.name,
    })),
  };

  // 2) Hunt for resurrect events across ALL events.
  const all = (fight.allEvents || fight.events || []);
  const typeCounts = {};
  all.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  const rez = all
    .filter(e => /res|revi/i.test(e.type) || (e.ability && /rebirth|raise ally|soulstone|intercession|ankh|reincarn|resurrect|redemption/i.test(e.ability.name)))
    .slice(0, 20)
    .map(e => ({
      timestamp: e.timestamp,
      type: e.type,
      ability: e.ability && e.ability.name,
      source: e.source && e.source.name,
      target: e.target && e.target.name,
    }));

  return {
    component: 'JsonTree',
    props: {
      data: {
        fightId: fight.id,
        allEventsCount: all.length,
        deathInfo,
        distinctEventTypes: Object.keys(typeCounts).sort(),
        typeCounts,
        rezCandidates: rez,
      }
    }
  };
};
