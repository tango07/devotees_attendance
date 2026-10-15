/**
 * Temple Devotee Attendance — backend script.
 *
 * SETUP (see README.md for full step-by-step with screenshots-level detail):
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any starter code and paste this entire file in.
 * 4. Change ADMIN_PIN below to a PIN only kitchen/temple staff know.
 * 5. Click Deploy > New deployment > type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the Web App URL it gives you — paste it into APPS_SCRIPT_URL
 *    in both index.html and admin.html.
 */

// ====== CONFIGURE THIS ======
var SHEET_NAME = 'Attendance';
var ADMIN_PIN = '1234'; // CHANGE ME before deploying
// =============================

/**
 * Handles form submissions from devotees (index.html).
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var name = (data.name || '').toString().trim();
    var phone = (data.phone || '').toString().trim();
    var headcount = parseInt(data.headcount, 10);
    var date = (data.date || '').toString().trim();

    if (!date) {
      date = formatDate_(new Date());
    }

    if (!headcount || headcount < 1) {
      return jsonOutput_({ success: false, error: 'Please enter a valid number of people (at least 1).' });
    }

    var sheet = getSheet_();
    sheet.appendRow([new Date(), date, name, phone, headcount]);

    return jsonOutput_({ success: true });
  } catch (err) {
    return jsonOutput_({ success: false, error: 'Server error: ' + err.message });
  }
}

/**
 * Handles the kitchen summary request from admin.html
 * (?action=summary&pin=XXXX).
 */
function doGet(e) {
  var action = e.parameter.action;

  if (action === 'summary') {
    if (String(e.parameter.pin) !== String(ADMIN_PIN)) {
      return jsonOutput_({ error: 'Invalid PIN' });
    }
    return jsonOutput_({ success: true, data: getSummary_() });
  }

  return jsonOutput_({ error: 'Unknown action' });
}

/**
 * Aggregates total headcount and number of submissions per date.
 */
function getSummary_() {
  var sheet = getSheet_();
  var rows = sheet.getDataRange().getValues();
  var summary = {}; // date string -> { people, submissions }

  for (var i = 1; i < rows.length; i++) { // row 0 is the header
    var date = (rows[i][1] || '').toString().trim();
    var headcount = Number(rows[i][4]) || 0;
    if (!date) continue;

    if (!summary[date]) {
      summary[date] = { people: 0, submissions: 0 };
    }
    summary[date].people += headcount;
    summary[date].submissions += 1;
  }

  return Object.keys(summary).sort().map(function (date) {
    return {
      date: date,
      people: summary[date].people,
      submissions: summary[date].submissions,
    };
  });
}

/**
 * Gets (or creates, with headers) the Attendance sheet.
 */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Date', 'Name', 'Phone', 'Headcount']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formatDate_(d) {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
