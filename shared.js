/**
 * Shared, dependency-free logic used by both index.html (devotee form) and
 * admin.html (kitchen summary). Kept separate from the inline <script> tags
 * so these pure functions can be unit tested with plain Node (see
 * tests/shared.test.js) without needing a browser.
 *
 * Works two ways:
 *  - In the browser: include with <script src="shared.js"></script> and use
 *    the global `TempleApp` object.
 *  - In Node (for tests): const TempleApp = require('./shared.js');
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TempleApp = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Formats a Date as 'YYYY-MM-DD' using LOCAL time (not UTC), so devotees
  // see their own today's date, not the server's. Defaults to right now.
  function todayStr(d) {
    d = d || new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  // Keeps a number within [min, max]. Falls back to `min` for anything that
  // isn't a valid number (used by the headcount +/- stepper buttons).
  function clamp(value, min, max) {
    var n = parseInt(value, 10);
    if (isNaN(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  // True only for whole numbers >= 1 (0, negatives, blank, and non-numeric
  // input are all invalid headcounts).
  function isValidHeadcount(value) {
    var n = parseInt(value, 10);
    return Number.isInteger(n) && String(n) === String(value).trim() && n >= 1;
  }

  // Builds the exact object sent to the Apps Script backend: trims the
  // optional name/phone fields and makes sure headcount is a number.
  function buildAttendancePayload(fields) {
    return {
      date: fields.date,
      headcount: parseInt(fields.headcount, 10),
      name: (fields.name || '').toString().trim(),
      phone: (fields.phone || '').toString().trim(),
    };
  }

  // The exact confirmation text shown on the full-screen "Thank You" view.
  function formatThankYouMessage(headcount, date) {
    var who = headcount === 1 ? 'person' : 'people';
    return 'Attendance for ' + headcount + ' ' + who + ' on ' + date + ' has been recorded. \u{1F64F}';
  }

  // Builds the admin summary request URL, including a cache-busting
  // timestamp. Without this, mobile browsers (especially iOS Safari) can
  // silently serve a stale cached response for the same URL, which is the
  // exact "Refresh does nothing" bug this guards against.
  function buildSummaryUrl(baseUrl, pin, timestamp) {
    timestamp = timestamp || Date.now();
    return baseUrl + '?action=summary&pin=' + encodeURIComponent(pin) + '&t=' + timestamp;
  }

  // Simple same-day comparison, both sides already in 'YYYY-MM-DD' form.
  function isToday(dateStr, todayStrValue) {
    return dateStr === todayStrValue;
  }

  return {
    todayStr: todayStr,
    clamp: clamp,
    isValidHeadcount: isValidHeadcount,
    buildAttendancePayload: buildAttendancePayload,
    formatThankYouMessage: formatThankYouMessage,
    buildSummaryUrl: buildSummaryUrl,
    isToday: isToday,
  };
});
