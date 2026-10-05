// Shared check-in contract between Coach (redirect) and Check-in (form vs. summary).
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  // localStorage key the Check-in page writes after a successful save
  function checkinKey(todayISO) {
    return 'checkin_' + todayISO;
  }

  // Subjective fields the check-in saves to today's date (stress and mood go to yesterday)
  const TODAY_FIELDS = ['soreness', 'fatigue', 'motivation', 'injury'];

  function hasCheckinValues(w) {
    return !!w && TODAY_FIELDS.some(f => w[f]);
  }

  Object.assign(root, { TODAY_FIELDS, checkinKey, hasCheckinValues });
  if (typeof module !== 'undefined') module.exports = { TODAY_FIELDS, checkinKey, hasCheckinValues };
})(typeof window !== 'undefined' ? window : globalThis);
