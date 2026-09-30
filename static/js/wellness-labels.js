// Labels and colours for Intervals wellness values 1–4 (1 = best): the single source for every page.
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  const WELLNESS = {
    mood:         { name: 'Mood',          labels: ['Great', 'Good', 'Avg', 'Low'] },
    soreness:     { name: 'Soreness',      labels: ['Low', 'Avg', 'High', 'Extreme'] },
    fatigue:      { name: 'Fatigue',       labels: ['Low', 'Avg', 'High', 'Extreme'] },
    motivation:   { name: 'Motivation',    labels: ['Extreme', 'High', 'Medium', 'Low'] },
    stress:       { name: 'Stress',        labels: ['Low', 'Moderate', 'High', 'Very high'], short: ['Low', 'Mod.', 'High', 'V. high'] },
    sleepQuality: { name: 'Sleep quality', labels: ['High', 'Good', 'Avg', 'Poor'] },
  };
  const WELLNESS_COLORS = ['#30d158', '#ff9f0a', '#ff3b30', '#bf5af2'];
  const WELLNESS_BTN_CLASSES = ['c-green', 'c-yellow', 'c-red', 'c-purple'];

  Object.assign(root, { WELLNESS, WELLNESS_COLORS, WELLNESS_BTN_CLASSES });
  if (typeof module !== 'undefined') module.exports = { WELLNESS, WELLNESS_COLORS, WELLNESS_BTN_CLASSES };
})(typeof window !== 'undefined' ? window : globalThis);
