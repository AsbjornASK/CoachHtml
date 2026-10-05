const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notificationStatus, STATUS_TEXT } = require('../static/js/push-status.js');

const base = { supported: true, standalone: true, ios: true, permission: 'granted', browserEndpoint: 'https://e/1', serverEndpoint: 'https://e/1' };

test('on only when the browser and the server have the same subscription', () => {
  assert.equal(notificationStatus(base), 'on');
  assert.equal(notificationStatus({ ...base, serverEndpoint: null }), 'off');
  assert.equal(notificationStatus({ ...base, serverEndpoint: 'https://e/old' }), 'off');
  assert.equal(notificationStatus({ ...base, browserEndpoint: null }), 'off');
});

test('iPhone Safari outside the Home Screen app must install first', () => {
  assert.equal(notificationStatus({ ...base, supported: false, standalone: false }), 'install');
  assert.equal(notificationStatus({ ...base, supported: false, ios: false, standalone: false }), 'unsupported');
});

test('denied permission is blocked', () => {
  assert.equal(notificationStatus({ ...base, permission: 'denied' }), 'blocked');
});

test('every status has English text', () => {
  for (const s of ['on', 'off', 'install', 'unsupported', 'blocked']) assert.equal(typeof STATUS_TEXT[s], 'string');
});
