// Shared check-in contract between Coach (redirect) and Check-in (form vs. summary).
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  // localStorage key the Check-in page writes after a successful save
  function checkinKey(todayISO) {
    return 'checkin_' + todayISO;
  }

  function hasCheckinValues(w) {
    return !!(w && (w.mood || w.soreness || w.fatigue || w.motivation));
  }

  root.checkinKey = checkinKey;
  root.hasCheckinValues = hasCheckinValues;
  if (typeof module !== 'undefined') module.exports = { checkinKey, hasCheckinValues };
})(typeof window !== 'undefined' ? window : globalThis);
