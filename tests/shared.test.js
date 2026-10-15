/**
 * Tests for shared.js — the pure logic used by both index.html and
 * admin.html (date formatting, headcount validation, payload building,
 * the thank-you message text, and the admin summary URL/cache-busting).
 *
 * Run with: node --test tests/
 * (Node's built-in test runner — no npm install needed.)
 */
const { test } = require('node:test');
const assert = require('node:assert');
const TempleApp = require('../shared.js');

test('todayStr formats a given date as YYYY-MM-DD (local time)', () => {
  const d = new Date(2026, 9, 5); // month is 0-indexed: October 5, 2026
  assert.strictEqual(TempleApp.todayStr(d), '2026-10-05');
});

test('todayStr pads single-digit month and day with a leading zero', () => {
  const d = new Date(2026, 0, 1); // January 1, 2026
  assert.strictEqual(TempleApp.todayStr(d), '2026-01-01');
});

test('todayStr defaults to the current date when no argument is given', () => {
  const result = TempleApp.todayStr();
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

test('clamp keeps values within [min, max]', () => {
  assert.strictEqual(TempleApp.clamp(5, 1, 50), 5);
  assert.strictEqual(TempleApp.clamp(0, 1, 50), 1); // below min -> min
  assert.strictEqual(TempleApp.clamp(99, 1, 50), 50); // above max -> max
});

test('clamp falls back to min for non-numeric input', () => {
  assert.strictEqual(TempleApp.clamp('abc', 1, 50), 1);
  assert.strictEqual(TempleApp.clamp(undefined, 1, 50), 1);
});

test('isValidHeadcount accepts positive whole numbers', () => {
  assert.strictEqual(TempleApp.isValidHeadcount('3'), true);
  assert.strictEqual(TempleApp.isValidHeadcount(1), true);
  assert.strictEqual(TempleApp.isValidHeadcount('50'), true);
});

test('isValidHeadcount rejects zero, negatives, blanks, and non-numbers', () => {
  assert.strictEqual(TempleApp.isValidHeadcount('0'), false);
  assert.strictEqual(TempleApp.isValidHeadcount(0), false);
  assert.strictEqual(TempleApp.isValidHeadcount('-2'), false);
  assert.strictEqual(TempleApp.isValidHeadcount(''), false);
  assert.strictEqual(TempleApp.isValidHeadcount('abc'), false);
  assert.strictEqual(TempleApp.isValidHeadcount('1.5'), false);
});

test('buildAttendancePayload trims optional fields and converts headcount to a number', () => {
  const payload = TempleApp.buildAttendancePayload({
    date: '2026-10-20',
    headcount: '4',
    name: '  Ravi  ',
    phone: ' 9876543210 ',
  });
  assert.deepStrictEqual(payload, {
    date: '2026-10-20',
    headcount: 4,
    name: 'Ravi',
    phone: '9876543210',
  });
});

test('buildAttendancePayload defaults missing name/phone to empty strings', () => {
  const payload = TempleApp.buildAttendancePayload({ date: '2026-10-20', headcount: '1' });
  assert.strictEqual(payload.name, '');
  assert.strictEqual(payload.phone, '');
});

test('formatThankYouMessage uses singular "person" for exactly 1', () => {
  assert.strictEqual(
    TempleApp.formatThankYouMessage(1, '2026-10-20'),
    'Attendance for 1 person on 2026-10-20 has been recorded. 🙏'
  );
});

test('formatThankYouMessage uses plural "people" for anything other than 1', () => {
  assert.strictEqual(
    TempleApp.formatThankYouMessage(4, '2026-10-20'),
    'Attendance for 4 people on 2026-10-20 has been recorded. 🙏'
  );
  assert.match(TempleApp.formatThankYouMessage(0, '2026-10-20'), /0 people/);
});

test('buildSummaryUrl includes the action, URL-encoded PIN, and a timestamp param', () => {
  const url = TempleApp.buildSummaryUrl('https://example.com/exec', '12 34', 999);
  assert.strictEqual(url, 'https://example.com/exec?action=summary&pin=12%2034&t=999');
});

test('buildSummaryUrl defaults the timestamp so repeated calls can bust the cache', () => {
  // This is the exact fix for the "Refresh does nothing" bug: every call
  // must produce a URL with a fresh `t` param so browsers/mobile Safari
  // don't serve a stale cached response.
  const url = TempleApp.buildSummaryUrl('https://example.com/exec', '1234');
  assert.match(url, /&t=\d+$/);
});

test('isToday compares two YYYY-MM-DD strings for equality', () => {
  assert.strictEqual(TempleApp.isToday('2026-10-15', '2026-10-15'), true);
  assert.strictEqual(TempleApp.isToday('2026-10-14', '2026-10-15'), false);
});
