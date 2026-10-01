// Labels and colours for Intervals wellness values 1–4 (1 = best): the single source for every page.
// day: 'yesterday' marks fields the morning check-in logs against yesterday's entry.
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  const WELLNESS = {
    mood:         { name: 'Mood',          labels: ['Great', 'Good', 'Avg', 'Low'], day: 'yesterday' },
    soreness:     { name: 'Soreness',      labels: ['Low', 'Avg', 'High', 'Extreme'] },
    fatigue:      { name: 'Fatigue',       labels: ['Low', 'Avg', 'High', 'Extreme'] },
    motivation:   { name: 'Motivation',    labels: ['Extreme', 'High', 'Medium', 'Low'] },
    stress:       { name: 'Stress',        labels: ['Low', 'Moderate', 'High', 'Very high'], short: ['Low', 'Mod.', 'High', 'V. high'], day: 'yesterday' },
    sleepQuality: { name: 'Sleep quality', labels: ['High', 'Good', 'Avg', 'Poor'] },
    sickness:     { name: 'Sick',          labels: ['No', 'Mild', 'Moderate', 'Severe'] },
  };
  const WELLNESS_COLORS = ['#30d158', '#ff9f0a', '#ff3b30', '#bf5af2'];
  const WELLNESS_BTN_CLASSES = ['c-green', 'c-yellow', 'c-red', 'c-purple'];

  Object.assign(root, { WELLNESS, WELLNESS_COLORS, WELLNESS_BTN_CLASSES });
  if (typeof module !== 'undefined') module.exports = { WELLNESS, WELLNESS_COLORS, WELLNESS_BTN_CLASSES };
})(typeof window !== 'undefined' ? window : globalThis);
