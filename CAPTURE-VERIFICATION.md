# Instant Capture verification — 2026-11-15

Implemented in the original MidnightDashboard folder. The new Documents/ChatGPT/Midnight workspace remains empty; the original project was not moved or replaced. No user settings, credentials, calendars or device data were edited by capture testing.

## Verified in headless Google Chrome

`tests/capture.e2e.cjs` runs against the local page with all integration API requests intercepted. Browser test data lives in temporary browser profiles, not the user's normal profile. The voice API is simulated; all recognition starts assert that on-device processing is enabled.

- Touch keyboard entry, draft restoration after close/reload, durable save and inbox display.
- Saving with browser networking disabled, then restoring the saved task after reloading online. No external or backend API is involved in storing captures.
- Task completion, editing, archive and restore; saved edits reopen correctly.
- Due reminder banner, overdue recovery on reload, and dismissal through Mark done.
- Final voice transcript insertion; denied microphone, missing microphone, language-pack download and unsupported-browser explanations.
- Failed local save leaves dialog open with original text; retry succeeds.
- Search and JSON backup download.
- Desktop 1440×1080 and narrow 390×844 screenshots reviewed; narrow capture has no horizontal overflow. Touch keyboard is 56px high on desktop and 48px on narrow screens. No JavaScript page errors in the captured scenarios.

Run with Playwright installed and a local Midnight server already running:

```sh
node tests/capture.e2e.cjs
```

Optional `PLAYWRIGHT_CHANNEL=chrome` uses installed Google Chrome. `PLAYWRIGHT_MODULE` can point to an existing Playwright package. `MIDNIGHT_TEST_URL` defaults to `http://127.0.0.1:8765`. Node/Playwright are development tools only; running Midnight needs no new dependency.

The backend suite passes (`.venv/bin/python -m pytest -q`: 35 tests, one dependency deprecation warning). The existing focus/weather model tests also pass: `node --test tests/test_focus.cjs tests/test_weather.cjs` (7 tests).

## Limits

A real microphone, browser permission prompt, language-pack support and recognition accuracy have not been tested on the Windows touchscreen. The implementation requires browser on-device recognition support; it does not silently use cloud recognition. Reminders require Midnight to be open, and overdue state recovers when it returns. Browser storage is profile/origin specific and is erased by clearing site data. JSON export is supported; import is not implemented. No closed-browser background alarm or cross-device sync is claimed.
