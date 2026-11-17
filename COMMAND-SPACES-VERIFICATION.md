# Midnight Command, Smart Spaces, icons and full calendar

Implemented in the existing Midnight source, completed November 16, 2026. The latest user
instruction keeps the release focused on desktop; compact/mobile optimization is not a
release target. The original FastAPI, vanilla JavaScript, IndexedDB captures, timer,
weather, RSS, Spotify and verified warmer integration remain in place.

## Features and use

- **Midnight Command:** Search button or Cmd/Ctrl+K from the dashboard and open panels.
  Search/Capture share the existing floating dialog; switching modes retains the draft.
  Cmd/Ctrl+Shift+Space opens Capture; the original capture shortcut also remains.
- Local fuzzy search covers commands, applications, available calendar data, saved notes,
  tasks, reminders, ideas, Spaces, settings and supported media/device actions. Loaded
  full-calendar months also enter the local index. Exact text wins over frequency boosts.
  Arrow keys/Enter and touch targets work. Search never creates captures.
- Local capture interpretation proposes Note/Task/Idea/Reminder and simple English dates
  (today, tomorrow, weekdays, ISO dates and an optional time). Apply is explicit; dates
  and types remain editable before save. It uses the original durable capture transactions.
- The existing optional touch keyboard now supports search and command execution. Settings
  can select automatic, Midnight or system/physical keyboard. Input mode prevents the app
  keyboard and system software keyboard from being requested together. Existing on-device
  dictation keeps its explicit permission/download/error behavior.
- **Smart Spaces:** Home, School, Entertainment and Focus arrange the same live widget
  nodes, not copies. Captures/tasks use the same IndexedDB records in every Space. Favorite
  HTTPS applications/shortcuts, names, outline icons, accents, local gradient backgrounds,
  spacing, widget order and supported widths are editable. Drag-and-drop and arrow buttons
  both reorder. New/duplicate/save/reset and confirmed deletion of user Spaces persist.
  Default Spaces can be reset and cannot be deleted. Empty layouts have an Add widgets state.
- Space changes use short FLIP/opacity transitions, with reduced-motion support. Switching
  does not reload, recreate widgets or initiate integration requests. Lightweight local
  suggestions can be accepted/dismissed or disabled; they never automatically switch Spaces.
- A consistent local SVG outline icon system replaces mixed symbol icons across navigation,
  search results, Space editing, panels, music navigation and calendar controls.
- **Full calendar:** Calendar → Full calendar opens a month/date-detail popup. Previous/next,
  Today and Jump to month support past/future browsing beyond the dashboard's two-week strip.
  The backend expands recurrence for a bounded requested window rather than limiting every
  request to the next 14 days. Timezones, all-day spans, durations and recurrence exclusions
  are preserved. The per-view cap is 2,000 events, with an explicit notice if reached.
- **ICS import:** Calendar settings provides an explicit Import selected file action. The
  existing Save preferences import also works. Validation precedes atomic snapshot file
  replacement. Invalid input keeps the prior snapshot and the selected file for correction.
  A successful import switches from subscription to the file, with this behavior stated in
  the interface. Files remain snapshots; calendar events are read-only.

## Files and components

New runtime modules: `static/command-core.js`, `static/command.js`, `static/spaces-store.js`,
`static/spaces.js`, `static/icons.js`, `static/calendar.js`, `static/command-spaces.css` and
`static/icons/mic.svg`.

Modified integration seams: `static/index.html`, `static/app.js`, `static/capture.js`,
`static/ui.js`, `server.py` and `sw.js`. The native dialog manager now tracks actual open
order so Command can promote an existing panel without resetting unfinished forms.
The shell cache is v4 and includes all new local assets.

New verification/build tools: `tests/test_command_spaces.cjs`, `tests/command-spaces.e2e.cjs`,
`tests/calendar.e2e.cjs`, isolated `tests/browser_server.py` and `scripts/build.py`.
Existing UI test locators were scoped where the same capture now also appears in a Space.

## Verification

- **18 JavaScript tests passed:** search ranking/typos, execution guards, capture parsing,
  Space persistence/reset/recovery, unsafe-link rejection, timer, weather and performance.
- **39 Python tests passed:** original backend integrations plus full calendar ranges,
  invalid ranges, historical/future events, imported source selection, validation, atomic
  replacement failure, recurrence exclusions and two-hour durations. One existing dependency
  deprecation warning remains.
- Existing Capture, Focus UI, general UI and 14-case desktop layout browser suites passed.
- New Command/Spaces browser suite passed: keyboard and touch search, touch Enter execution,
  draft preservation, settings preservation, parsing/apply, shared indexing, Space duplicate,
  drag and accessible reorder, sizes/widgets/shortcuts/persistence, confirmed deletion,
  device success/failure and duplicate-write guard, suggestions, keyboard disablement,
  shared nodes, no refetch on switching, and offline search/Space changes.
- The calendar browser suite passed against the actual FastAPI application through an
  isolated test bridge: actual file selection/import, past/future/recurring/all-day display,
  invalid-file failure, snapshot replacement through Save preferences and reload persistence.
  These are backend imports, not a simulated success response.
- JavaScript syntax and Python parsing checks are part of the production build.
  `python3 scripts/build.py` creates `dist/Midnight.zip` and a SHA-256 file manifest, excluding
  private data, credentials, virtual environments and browser test profiles.

All tests use temporary browser storage and temporary backend data. No live account or
physical device was changed. The user's running server was not restarted during testing.

## Settings and limits

No new paid API, cloud account or runtime dependency is required. Capture/Spaces/search use
browser-local storage. Existing integrations retain their own setup requirements. Real voice
recognition still requires a supported on-device browser implementation and a microphone;
voice checks simulate its states and do not establish Windows hardware compatibility.

Continue Watching and unsupported media catalogs are not fabricated. Application shortcuts
open real HTTPS destinations; they do not imply media-library integration. Search uses data
already available locally; live calendar/weather/media refresh still requires the existing
local server/network. The calendar caches viewed months in memory, not as an offline database.
Capture parsing is deliberately limited and editable. The existing ChatGPT handoff remains
manual and does not promise automatic synchronization or memory retention.

**Restart Midnight once for the new calendar backend, then close all old Midnight tabs and
reopen to activate the v4 interface cache.**
