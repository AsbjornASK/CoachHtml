// Shared by every page: registers the service worker and adds the Profile icon to the top bar.
(function () {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  const bar = document.querySelector('.topbar');
  if (!bar || location.pathname === '/profile.html') return;
  const style = document.createElement('style');
  style.textContent = '.topbar-title{margin-right:auto}.topbar-profile{display:flex;color:#007aff;flex-shrink:0;margin-left:12px}.topbar-profile svg{width:24px;height:24px}';
  document.head.appendChild(style);
  const a = document.createElement('a');
  a.href = '/profile.html';
  a.className = 'topbar-profile';
  a.setAttribute('aria-label', 'Profile');
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  bar.appendChild(a);
})();
