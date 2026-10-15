# 🛕 Temple Devotee Attendance

A dead-simple app for devotees to mark that they're coming for darshan and
the post-darshan meal, so the kitchen knows roughly how many people to cook
for. No app store, no login system, no server to maintain — just a free
GitHub Pages website and a free Google Sheet as the "database".

## How it works

- **`index.html`** — the public page devotees open on their phone. They pick
  a date, how many people, and optionally their name/phone, then tap submit.
- **`admin.html`** — a PIN-protected page for kitchen staff showing total
  expected headcount per day.
- **`apps-script/Code.gs`** — a tiny backend script (runs free on Google's
  servers) that saves every submission as a row in a Google Sheet, and
  answers the summary request for `admin.html`.
- **`shared.js`** — small helper functions (date formatting, headcount
  validation, etc.) used by both pages, kept in one place so they're easy to
  test and can't drift out of sync with each other.
- Every submission is also visible as a normal row in your Google Sheet, if
  staff ever want to open it directly.

No database, no hosting bill, nothing to renew. Everything here is free.

## Running the tests

There's a small automated test suite in `tests/` that checks the core
behavior (date defaults, headcount validation, the thank-you message text,
the admin PIN check, and the per-day totals), so a future change is less
likely to quietly break something.

It needs nothing but Node.js (which you likely already have if you've ever
run anything JavaScript-related) — no npm install, no extra packages:

```bash
cd devotees_attendance
node --test tests/*.test.js
```

You should see something like `# pass 26` / `# fail 0` at the bottom. Run
this after making any change to `shared.js`, `index.html`'s or
`admin.html`'s logic, or `apps-script/Code.gs`, to make sure nothing broke.

## One-time setup (about 10 minutes)

### 1. Create the Google Sheet + backend script

1. Go to [sheets.google.com](https://sheets.google.com) and create a new,
   blank spreadsheet. Name it something like "Temple Attendance".
2. In the Sheet, click **Extensions > Apps Script**.
3. Delete the sample code you see there, then open
   [`apps-script/Code.gs`](apps-script/Code.gs) from this repo, copy its
   entire contents, and paste it into the Apps Script editor.
4. Near the top of the script, change this line to a PIN only your kitchen
   staff/volunteers know (keep it numeric and simple so it's easy to type on
   a phone, e.g. a 4-digit PIN):
   ```js
   var ADMIN_PIN = '1234'; // CHANGE ME
   ```
5. Click **Save** (the floppy disk icon).
6. Click **Deploy > New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**.
7. The first time, Google will ask you to authorize the script — click
   through "Advanced > Go to [project name] (unsafe)" and allow it. This
   warning is normal; it's just Google being cautious about a script you
   wrote yourself.
8. Copy the **Web app URL** it gives you (looks like
   `https://script.google.com/macros/s/XXXXXXX/exec`). You'll need it next.

### 2. Connect the website to the script

1. Open `index.html` in this repo, find this line near the bottom, and
   replace the placeholder with the URL you copied:
   ```js
   const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
2. Do the exact same thing in `admin.html`.

### 3. Put the code in your GitHub repo

If you're reading this file from your working folder, you already have all
the files you need (`index.html`, `admin.html`, `style.css`,
`apps-script/Code.gs`, `README.md`). Push them to your repo:

```bash
cd devotees_attendance        # your local clone of https://github.com/tango07/devotees_attendance
git add .
git commit -m "Add devotee attendance app"
git push
```

(If you haven't cloned the repo locally yet, run
`git clone https://github.com/tango07/devotees_attendance.git` first, then
copy these files into that folder before running the commands above.)

**No git/command line?** You can instead go to
`https://github.com/tango07/devotees_attendance`, click **Add file > Upload
files**, and drag in all the files (keep `Code.gs` inside an `apps-script`
folder).

### 4. Turn on GitHub Pages (makes it a live website)

1. On GitHub, open your repo → **Settings > Pages**.
2. Under "Build and deployment", set **Source** to "Deploy from a branch".
3. Set **Branch** to `main` and folder to `/ (root)`, then **Save**.
4. After a minute, GitHub will show you a live URL, usually:
   ```
   https://tango07.github.io/devotees_attendance/
   ```
   That's the link devotees will use.

## Sharing the links

- **Devotees** → share the home page link (`.../devotees_attendance/`) on
  WhatsApp groups, the temple notice board, or your temple's website.
- **Kitchen staff only** → share the summary page link
  (`.../devotees_attendance/admin.html`) plus the PIN, privately. Don't post
  this one publicly — it's not heavily secured, just PIN-gated enough to
  keep casual visitors out.

## Updating the PIN or checking raw data later

- To change the PIN, edit `ADMIN_PIN` in the Apps Script editor and re-deploy
  (**Deploy > Manage deployments > Edit > Deploy**).
- To see every individual submission (not just totals), just open the Google
  Sheet directly — every row is there with timestamp, date, name, phone, and
  headcount.

## Notes on the "security" of the admin page

This app is intentionally simple, as requested — there's no real user
accounts or encryption, just a shared PIN. That's appropriate for data that's
just headcounts (nothing sensitive), but don't reuse this PIN anywhere else,
and don't publicly post the admin.html link.
