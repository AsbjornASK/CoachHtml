// Notification status shown on the Profile page.
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  function notificationStatus({ supported, standalone, ios, permission, browserEndpoint, serverEndpoint }) {
    if (!supported) return ios && !standalone ? 'install' : 'unsupported';
    if (permission === 'denied') return 'blocked';
    return browserEndpoint && browserEndpoint === serverEndpoint ? 'on' : 'off';
  }

  const STATUS_TEXT = {
    on:          'On. You get a notification every morning.',
    off:         'Off.',
    install:     'Add Coach to your Home Screen first: tap Share, then Add to Home Screen, and open it from there.',
    unsupported: 'This browser does not support notifications.',
    blocked:     'Blocked. Allow notifications for Coach in iOS Settings → Notifications.',
  };

  Object.assign(root, { notificationStatus, STATUS_TEXT });
  if (typeof module !== 'undefined') module.exports = { notificationStatus, STATUS_TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
