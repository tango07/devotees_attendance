/**
 * Tests for apps-script/Code.gs — the backend that saves attendance
 * submissions and serves the kitchen summary.
 *
 * Google Apps Script code can't run directly in Node (it depends on
 * Apps-Script-only globals like SpreadsheetApp, ContentService, Utilities,
 * and Session), so this loads the REAL Code.gs source into a Node `vm`
 * sandbox with lightweight fakes for those globals, backed by an in-memory
 * "sheet". This means these tests exercise the actual shipped code, not a
 * reimplementation of it — if someone edits the validation or aggregation
 * logic in Code.gs, these tests catch it.
 *
 * Run with: node --test tests/
 */
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const CODE_GS_PATH = path.join(__dirname, '..', 'apps-script', 'Code.gs');

function formatDateLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Loads a fresh copy of Code.gs into its own sandbox with an empty
// in-memory "spreadsheet", so each test starts with a clean slate.
function loadCodeGs() {
  const src = fs.readFileSync(CODE_GS_PATH, 'utf8');
  const sheets = {};

  function createFakeSheet(name) {
    const sheet = { name, rows: [], frozenRows: 0 };
    sheet.appendRow = (row) => sheet.rows.push(row);
    sheet.getDataRange = () => ({ getValues: () => sheet.rows });
    sheet.setFrozenRows = (n) => { sheet.frozenRows = n; };
    return sheet;
  }

  const fakeSpreadsheet = {
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => {
      const sheet = createFakeSheet(name);
      sheets[name] = sheet;
      return sheet;
    },
  };

  const sandbox = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => fakeSpreadsheet,
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        _text: text,
        _mime: null,
        setMimeType(type) {
          this._mime = type;
          return this;
        },
      }),
    },
    Utilities: {
      formatDate: (d /* tz, fmt ignored by this fake */) => formatDateLocal(d),
    },
    Session: {
      getScriptTimeZone: () => 'Etc/UTC',
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'Code.gs' });
  sandbox.__sheets = sheets;
  return sandbox;
}

function post(ctx, body) {
  const res = ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(res._text);
}

function get(ctx, params) {
  const res = ctx.doGet({ parameter: params });
  return JSON.parse(res._text);
}

test('doPost rejects a headcount of 0 and does not touch the sheet', () => {
  const ctx = loadCodeGs();
  const body = post(ctx, { date: '2026-10-20', headcount: 0 });
  assert.strictEqual(body.success, false);
  assert.match(body.error, /valid number/i);
  assert.strictEqual(ctx.__sheets['Attendance'], undefined);
});

test('doPost rejects a negative or non-numeric headcount', () => {
  const ctx = loadCodeGs();
  assert.strictEqual(post(ctx, { date: '2026-10-20', headcount: -3 }).success, false);
  assert.strictEqual(post(ctx, { date: '2026-10-20', headcount: 'abc' }).success, false);
});

test('doPost returns a graceful error for malformed JSON instead of crashing', () => {
  const ctx = loadCodeGs();
  const res = ctx.doPost({ postData: { contents: 'not valid json' } });
  const body = JSON.parse(res._text);
  assert.strictEqual(body.success, false);
  assert.match(body.error, /server error/i);
});

test('doPost appends a row with the given date, and defaults name/phone to empty strings', () => {
  const ctx = loadCodeGs();
  const body = post(ctx, { date: '2026-10-20', headcount: 3 });
  assert.strictEqual(body.success, true);

  const rows = ctx.__sheets['Attendance'].rows;
  assert.strictEqual(rows.length, 2); // header row + 1 data row
  // Spread into a plain array first: arrays created inside the vm sandbox
  // belong to a different JS "realm", so deepStrictEqual would otherwise
  // (correctly, but unhelpfully) treat them as unequal despite matching
  // contents.
  assert.deepStrictEqual([...rows[0]], ['Timestamp', 'Date', 'Name', 'Phone', 'Headcount']);

  const [timestamp, date, name, phone, headcount] = rows[1];
  // `timestamp instanceof Date` would fail here even for a real Date: it was
  // constructed using the sandbox's own Date, a different realm than this
  // test file's. Object.prototype.toString works across realms.
  assert.strictEqual(Object.prototype.toString.call(timestamp), '[object Date]');
  assert.strictEqual(date, '2026-10-20');
  assert.strictEqual(name, '');
  assert.strictEqual(phone, '');
  assert.strictEqual(headcount, 3);
});

test('doPost keeps name/phone when provided', () => {
  const ctx = loadCodeGs();
  post(ctx, { date: '2026-10-20', headcount: 2, name: 'Ravi', phone: '9876543210' });
  const [, , name, phone] = ctx.__sheets['Attendance'].rows[1];
  assert.strictEqual(name, 'Ravi');
  assert.strictEqual(phone, '9876543210');
});

test('doPost defaults the date to today when none is provided', () => {
  const ctx = loadCodeGs();
  post(ctx, { headcount: 1 });
  const rows = ctx.__sheets['Attendance'].rows;
  assert.strictEqual(rows[1][1], formatDateLocal(new Date()));
});

test('getSheet_ auto-creates the Attendance sheet with a header row on first use', () => {
  const ctx = loadCodeGs();
  assert.strictEqual(ctx.__sheets['Attendance'], undefined);
  post(ctx, { date: '2026-10-20', headcount: 1 });
  assert.ok(ctx.__sheets['Attendance']);
  assert.deepStrictEqual([...ctx.__sheets['Attendance'].rows[0]], ['Timestamp', 'Date', 'Name', 'Phone', 'Headcount']);
});

test('doGet summary rejects an incorrect PIN', () => {
  const ctx = loadCodeGs();
  const body = get(ctx, { action: 'summary', pin: 'wrong' });
  assert.strictEqual(body.error, 'Invalid PIN');
});

test('doGet with an unknown action returns an error', () => {
  const ctx = loadCodeGs();
  const body = get(ctx, {});
  assert.strictEqual(body.error, 'Unknown action');
});

test('doGet summary returns an empty array when there is no data yet', () => {
  const ctx = loadCodeGs();
  const body = get(ctx, { action: 'summary', pin: '1234' });
  assert.strictEqual(body.success, true);
  assert.deepStrictEqual(body.data, []);
});

test('doGet summary aggregates total headcount and submission count per date, sorted ascending', () => {
  const ctx = loadCodeGs();
  post(ctx, { date: '2026-10-20', headcount: 4, name: 'Ravi' });
  post(ctx, { date: '2026-10-19', headcount: 2 });
  post(ctx, { date: '2026-10-20', headcount: 1, name: 'Sita' });

  const body = get(ctx, { action: 'summary', pin: '1234' });
  assert.strictEqual(body.success, true);
  assert.deepStrictEqual(body.data, [
    { date: '2026-10-19', people: 2, submissions: 1 },
    { date: '2026-10-20', people: 5, submissions: 2 },
  ]);
});

test('doGet summary ignores rows that failed validation (never got appended)', () => {
  const ctx = loadCodeGs();
  post(ctx, { date: '2026-10-20', headcount: 2 });
  post(ctx, { date: '2026-10-20', headcount: 0 }); // rejected, should not count
  const body = get(ctx, { action: 'summary', pin: '1234' });
  assert.deepStrictEqual(body.data, [{ date: '2026-10-20', people: 2, submissions: 1 }]);
});
