# Midnight Today upgrade · November 17, 2026

## What changed

- A collapsible Today panel above the dashboard. It appears in Home, School and Focus, and stays out of Entertainment.
- Pick up to three priorities from existing captures. Complete or edit tasks directly, start/resume their focus timer, and undo completion from Done today.
- Due and overdue tasks remain visible even when planned for tomorrow. Previous-day priorities appear as carry-over in All other tasks. Planning never changes a due date.
- Optional due dates for tasks, in addition to required dates for reminders. Task dates are organizational; reminder notifications remain exclusive to reminders.
- Next event from the connected calendar, with an explicit unavailable state and stale-calendar notice on refresh failure.
- Capture backup restore with file validation, preview and explicit import. Duplicate IDs are skipped and existing captures and drafts are preserved. IndexedDB imports use a single transaction.
- Today is searchable in Command. New assets are included in the offline shell, bumped to v6.
- Existing palettes, Spaces, integrations and touch keyboard remain in place. No paid APIs or new accounts.

## Validation completed

- 42 Python tests passed: backend/performance plus installer preservation, source mismatch rejection and rollback.
- 22 JavaScript tests passed: planning/date boundaries, backup validation, search/Spaces, timers, weather and request deduplication.
- 2 in-process UI-model integration tests passed: selection/cap, focus/pause, completion/reopen, due visibility, tomorrow retaining deadlines and storage-failure messaging. These use a DOM model, not a real browser.
- All application JavaScript syntax and referenced static assets validated by the distribution builder.
- Installer checked against isolated fixtures: normal upgrade, retained settings/data, source backup and rejection when baseline hashes differ.

## Checks requiring a browser

This session could not start a listening web server or launch a headless browser. The in-app browser also denied file previews. No real browser rendering, capture browser regression run, real IndexedDB import, service-worker upgrade or microphone verification is claimed for this release.

`tests/today.e2e.cjs` covers priorities, focus, completion/undo, task dates, reload, backup import and malformed-file rejection, plus 1024/1440/1920px overflow checks across Midnight, Daylight, Graphite and Sand. Run it, the existing `tests/capture.e2e.cjs`, and `tests/desktop-layout.e2e.cjs` against the updated app in a permitted browser environment.

## Apply to Joe's existing installation

1. Stop the existing Midnight server.
2. Double-click `Apply Midnight Update.command` from this release folder.
3. Restart using the existing installation's Start Dashboard launcher. Reopen the dashboard to allow the new offline shell to activate; if an old worker still controls it, close the dashboard's other tabs and reopen.

The installer compares the existing source to the baseline recorded for this release, saves a rollback copy under `upgrade-backups`, and replaces application source only. It does not touch `data`, `.venv`, or browser storage. If the source has changed, it stops for review. The existing installation was not modified by this build session.

## Limits

Daily planning uses this computer's local date. Priorities and capture backups follow the same browser/origin as existing captures. Completed-today counts start with completions recorded by this release; older completed items are preserved in Inbox. Restore deliberately keeps existing IDs rather than overwriting newer edits. Speech and external integrations retain their previous availability requirements.
