// Matches today's calendar training sessions to Intervals.icu activities.
// Loaded as a classic <script> in the browser and required by the Node tests.
// The activity-type side mirrors categoryOf() in api/get-sport-load.mjs; keep them in sync.
(function (root) {
  // Title words must start a word ("Running", "Cykeltur") so "Crunches" or "Strides" don't match
  const SPORT_RULES = [
    { sport: 'run',      title: /\brun/i,           type: t => /Run/.test(t) },
    { sport: 'strength', title: /\bstrength/i,      type: t => t === 'WeightTraining' },
    { sport: 'ride',     title: /\b(cykel|ride)/i,  type: t => /Ride/.test(t) },
  ];

  const ruleFor = title => SPORT_RULES.find(r => r.title.test(title)) ?? null;

  function sportOf(title) {
    return ruleFor(title)?.sport ?? null;
  }

  function hhmm(t) {
    return t ? t.replace(/\D/g, '').padStart(4, '0') : null;
  }

  function sessionStatuses(events, activities, nowHHMM) {
    const used = new Set();
    return (events ?? [])
      .filter(e => e.category === 'training')
      .sort((a, b) => (a.timeStart ?? '').localeCompare(b.timeStart ?? ''))
      .map(e => {
        const rule = ruleFor(e.title);
        if (!rule || activities == null) return { ...e, status: null };
        const idx = activities.findIndex((a, i) => !used.has(i) && rule.type(a.type ?? ''));
        if (idx >= 0) { used.add(idx); return { ...e, status: 'done' }; }
        const end = hhmm(e.timeEnd);
        return { ...e, status: end && end <= nowHHMM ? 'missed' : 'planned' };
      });
  }

  root.sessionStatuses = sessionStatuses;
  root.sportOf = sportOf;
  root.hhmm = hhmm;
  if (typeof module !== 'undefined') module.exports = { sessionStatuses, sportOf, hhmm };
})(typeof window !== 'undefined' ? window : globalThis);
