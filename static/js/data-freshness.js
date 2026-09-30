// Warns when weight or body composition hasn't been logged for a while.
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  const WEIGHT_DAYS = 7;
  const BODY_COMP_DAYS = 21;

  function daysSince(dateISO, todayISO) {
    if (!dateISO) return null;
    return Math.round((Date.parse(todayISO) - Date.parse(dateISO)) / 86_400_000);
  }

  // Warns only once the limit is exceeded (8+ / 22+ days). A missing date (nothing inside
  // the API's 21-day data window) always warns, with days: null.
  function freshnessWarnings({ today, lastWeightDate, lastBodyCompDate }) {
    const out = [];
    const w = daysSince(lastWeightDate, today);
    if (w == null || w > WEIGHT_DAYS) out.push({ kind: 'weight', days: w });
    const b = daysSince(lastBodyCompDate, today);
    if (b == null || b > BODY_COMP_DAYS) out.push({ kind: 'bodyComp', days: b });
    return out;
  }

  root.daysSince = daysSince;
  root.freshnessWarnings = freshnessWarnings;
  if (typeof module !== 'undefined') module.exports = { daysSince, freshnessWarnings };
})(typeof window !== 'undefined' ? window : globalThis);
