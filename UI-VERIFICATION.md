# Midnight UI verification — November 15, 2026

Changes were made in the existing MidnightDashboard source directory, retaining FastAPI,
vanilla JavaScript, the capture store, timer model and performance improvements. No Git
repository exists in this source folder. The running user server was not restarted.
Private data and physical devices were not used for testing.

## Implemented

- Fixed narrow header overlap and clipped Focus controls. Breakpoints give tablets a
  two-column utility layout and phones a stacked layout with paired Focus/warmer cards.
- Refined system typography, semantic surfaces, borders, pressed states and touch targets.
- Added Graphite and Sand, preserving all eight existing palettes. Settings offers ten
  instant theme previews; select and pressed state stay synchronized and persist locally.
- Native dialogs share entrance/exit motion, sticky headers/actions, scroll containment,
  Escape and focus behavior. Inbox → Capture uses a direct handoff. Shortcut capture over
  Settings preserves unfinished fields and returns focus. Reduced motion disables animation.
- Remembered touch-keyboard visibility; direct jumps to relevant settings; fullscreen labels.
- Added app-shell-only offline caching via `/sw.js`. Installation must complete on an
  online visit. A later update waits for old clients to close. Only fixed local assets
  are cached; no API responses or private data are cached by the worker.

## Checks

- Python API suite: **36 passed**; one existing dependency deprecation warning.
- JavaScript focus/weather/performance tests: **10 passed**.
- `tests/capture.e2e.cjs`: passed in headless Google Chrome with isolated browser storage
  and mocked integrations. Covers typing, touch keyboard, draft recovery, offline saving,
  edit/done/archive/restore, reminders, search/export, storage failure/retry and local voice
  simulation. Screenshot checks cover desktop and narrow capture layouts.
- `tests/ui.e2e.cjs`: passed in headless Google Chrome at **320, 390, 560, 768, 1024, 1440
  and 1920px**. Covers page overflow, clock/action separation, minimum touch targets and
  control containment, all themes, persistence, panel switching, unsaved Settings recovery,
  keyboard choice, settings jumps, narrow forecast, reader, reduced motion, cache contents,
  offline reload, offline capture save and offline Focus start. No browser page errors.
- JavaScript syntax and Python compilation checks passed.
- Desktop, narrow layout, capture, Graphite and Sand screenshots visually reviewed. Test
  screenshots contain synthetic integration data only.

## Reproduce

Use a local development server and the environment options described in
`CAPTURE-VERIFICATION.md`. All browser integration calls are intercepted. Example:

```sh
PLAYWRIGHT_CHANNEL=chrome node tests/capture.e2e.cjs
PLAYWRIGHT_CHANNEL=chrome node tests/ui.e2e.cjs
node --test tests/test_focus.cjs tests/test_weather.cjs tests/test_performance.cjs
PYDANTIC_DISABLE_PLUGINS=__all__ PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest -q
```

This session used an isolated static UI server and temporary backend data, leaving the
user's port 8765 server and normal browser profile alone. Browser voice was simulated;
a real microphone and Windows touchscreen hardware remain untested. Firefox and Safari
were not tested. No paid service or runtime dependency was added.

## Follow-up: custom Focus and ChatGPT handoff

- Added custom 1–180 minute entry, remembered duration and direct start. Cancel leaves the
  current session untouched. Existing presets and absolute-deadline persistence remain.
- Quiet CSS rainfall runs with the timer and stops on pause/completion. A small, dismissible
  completion popover has a checkmark and one brief confetti burst. It preserves capture
  keyboard focus, including when another dialog is open. Reduced motion suppresses effects.
- Inbox offers an explicit clipboard handoff and the verified pinned Quick Capture chat
  destination. No automatic sync, cloud upload or saved-memory write was implemented.
- Service-worker cache bumped to v2 to ship the updated shell on a later visit.
- **11 JavaScript model/performance tests passed**. All **three browser suites passed**:
  existing Capture, responsive UI, and the new `tests/focus-ui.e2e.cjs`.
- New browser checks cover custom 37-minute start, pause/reload recovery, bounds and cancel,
  a simulated one-minute completion while typing in Capture, usable celebration dismissal,
  clipboard success/denial, correct chat destination, 320–1440px custom UI, reduced motion,
  and custom timer start after offline reload. No integration mutation requests occurred.
- Custom mobile and completion screenshots were visually reviewed and saved in
  `verification/ui/`. Backend code and real user storage were not changed by this follow-up.

## Four-pass desktop and Capture review

Current scope supersedes the earlier phone checks: desktop monitors, desktop touchscreens
and compact desktop windows, with no phone optimization. The source's AGENTS.md now states
this target. The old tests checked controls within cards but missed intersections between
separate cards. The new layout suite explicitly rejects those intersections.

All four design passes were implemented and visually reviewed against the actual page.
See `DESIGN-NOTES.md` for the changes and `verification/design/pass4-*` for the final views.

Final checks:

- **11 JavaScript model/performance tests passed.**
- **Four real-browser suites passed** in headless Google Chrome, with temporary browser
  storage and mocked account/device integrations: Capture, Focus UI, general UI and the
  new desktop layout suite.
- Desktop geometry covers **1024×768, 1152×864, 1280×720, 1366×768, 1440×900, 1920×1080
  and 2560×1440**, each with mouse and touch input. No intersecting cards or clipped
  primary controls. Long reminder/track text, sticky Inbox search, confirmed draft status,
  reachable reminder Save/Close and direct warmer setup are covered.
- Capture checks retain offline save/reload, drafts, edits, task completion, archive/restore,
  reminder recovery, simulated on-device voice/errors, storage failure/retry, export and
  search. New Clear search and task-circle behavior pass those existing flows.
- Focus checks cover custom durations, presets in the picker, pause/reload, completion
  without stealing capture focus, reduced motion and offline use. Display assertions allow
  a few seconds of real elapsed browser time; exact duration persistence is also checked.
- Offline worker checks include actual offline reopening and missing cached HTML/CSS
  falling back to the local server. No API data is added to the shell cache.
- JavaScript syntax checks passed. Backend code was unchanged during these four passes;
  the prior backend result remains 36 passed rather than being claimed as a new run.

The normal browser profile, private records, running port 8765 server and physical devices
were left alone. No new runtime dependency, account or paid service was added. Real
microphone, Windows touchscreen hardware, Safari and Firefox were not tested here.

Close all Midnight tabs, then reopen to activate the v3 shell and its matching assets.
