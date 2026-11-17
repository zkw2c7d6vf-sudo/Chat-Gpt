# Midnight performance work — November 15, 2026

## Scope

Edited `server.py`, `static/app.js`, `static/weather.js`, and performance tests. The existing focus model in `static/focus.js` already uses absolute deadlines and writes storage only on state changes; it needed no modification. Rendering improvements live in `app.js`.

Instant Capture files, HTML, CSS, design notes, README, and private user data were left alone. The user-owned server at port 8765 was not restarted or used for device/account operations. No dependencies or paid services were added.

## Measurements

Local Node microbenchmark: seven daily selections from a forecast containing 168 hourly readings, 25 samples, America/New_York. The original implementation's median was **31.13 ms**. The revised implementation's median was **0.24 ms for a fresh forecast snapshot** with date formatting initialized, and **0.025 ms for repeat selections**. Initial Intl initialization is excluded from those revised warm-formatting medians; it remains a one-time cost. These numbers measure the forecast selection logic, not browser painting or total page load.

The original forecast code constructed an Intl formatter for every date comparison and scanned all hours seven times. The revised implementation shares a bounded set of formatters and indexes hours once per immutable forecast snapshot and timezone. A WeakMap allows old forecast snapshots to be collected. It preserves local midnight and 25-hour daylight-saving fallback days.

An isolated benchmark using the fully imported server module exercised twelve mock feeds, each delayed by 50 ms. The original sequential endpoint took **648.55 ms** and the revised concurrent endpoint took **155.37 ms** (about 76% less elapsed time). These are direct endpoint-function calls, excluding HTTP transport. This isolates request overlap from DNS, publisher latency, and parsing. Separate function-level checks also passed for two simultaneous readers, bounded workers, ordered partial failures, invalidation, and cancellation of one reader.

## Changes

- News feeds load concurrently, with at most four blocking feed workers active at once. Source order and per-feed errors remain stable. Concurrent tabs share in-progress feed loads. Existing 15-minute caching remains in place. Invalidating preferences prevents old in-progress loads from repopulating the cache.
- Identical in-progress browser GET requests share a fetch, with entries removed on success or failure. Mutation requests are never combined, retried, or cached.
- Date formatters are reused with bounded caches. Calendar day counts are computed once per refresh rather than filtering every event fourteen times.
- Clock text updates once per minute; music progress and running focus displays still update each visible second. Unchanged focus state skips DOM updates. Hidden tabs skip the display heartbeat and immediately reconcile absolute focus deadlines when visible again.
- Weather only requests another calendar refresh when the timezone needs updating. Calendar responses from a superseded timezone are ignored.

## Verification and limits

JavaScript tests cover existing forecast and timer behavior, timezone and DST grouping, forecast replacement, GET sharing and retry after errors, distinct mutations, idle focus rendering, and completion after sleep. Python tests cover bounded concurrency across simultaneous news requests, source order, partial failures, and invalidation during a fetch, alongside existing API behavior tests.

No live publisher, weather, Spotify, or plug calls are needed for validation. Tests use mock transports, mock feed workers, and temporary data directories. Publisher/network delays, image downloads, device latency, and real-browser paint time remain variable. No end-to-end visual performance claim is made. Backend changes take effect when the user next restarts their existing server; no restart was performed here.

## Final check results

- `node --test tests/test_focus.cjs tests/test_weather.cjs tests/test_performance.cjs`: **10 passed**.
- Python API and performance suite: **35 passed**. Test startup used a temporary `MIDNIGHT_DATA` directory, `PYDANTIC_DISABLE_PLUGINS=__all__`, and `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` to avoid unrelated installed-plugin discovery. No runtime settings were changed. One existing Starlette/AnyIO deprecation warning remains.
- Python compilation and JavaScript syntax checks passed.
- Full-suite elapsed time was 202.56 seconds, dominated by dependency-file loading. This is test setup time, not a dashboard response-time measurement.

The source project has no Git repository; changes were made in place. Added test files are `tests/test_performance.py` and `tests/test_performance.cjs`. Existing tests and the focus model were preserved.

## GitHub performance pass — November 17, 2026

This pass starts from the verified `midnight` branch at
`37b0c63ca66ed799cda4d6006bcc2273b5766249`. It retains the interface,
integrations, fuzzy search rules, capture data formats and reminder behavior.

- Capture reads share an invalidatable in-memory snapshot. Successful item
  transactions invalidate it only after committing. Concurrent readers share
  storage work; an edit arriving during a read forces a fresh snapshot. Callers
  receive separate record copies. Local writes, backup restores, cross-tab
  messages, opening Inbox and returning to a visible tab retain refresh paths.
- The 30-second reminder check uses that snapshot and only updates notifications
  when the due set or its content changes. It skips hidden tabs. Browsers without
  BroadcastChannel retain the database polling fallback. Due reminders still
  appear within the existing 30-second check interval or upon returning.
- Search builds its index when opened and refreshes while open. It prepares
  normalized titles and unique search words once per snapshot, normalizes each
  query once, and stops comparisons when the best possible word score is found.
  Exact/prefix/typo scores, accents, multiple terms, usage/context boosts and the
  40-result limit are unchanged. Obsolete asynchronous rebuilds are discarded.
- Wallpaper metadata, stills and credits remain available with motion off,
  Reduced Motion on or a hidden tab. Video loading waits until playback is
  allowed. Identical pending sources are shared, hidden pending loads cancel,
  and the previous video source is released after a scene switch. Active video
  pauses and resumes as before; non-video themes release both sources.
- Successful public `/static/` assets permit storage with mandatory HTTP
  revalidation. An unchanged ETag produces a body-free 304. HTML, the worker,
  API responses and errors retain `no-store`; security headers are unchanged.
  The worker and shell asset versions are bumped together.

### Controlled measurements

| Operation | Before | After |
| --- | ---: | ---: |
| Full capture reads in 120 simulated visible idle checks (one hour), with Tasks and Search consumers | 360 | 0 |
| Median of four searches over 1,000 synthetic captures (15 samples) | 644.91 ms | 9.05 ms |
| Index construction for those captures | 0.67 ms | 25.92 ms |

The search corpus uses classroom notes and repeated long keywords; queries cover
typos, multiple words and no match. The search timing excludes index construction;
preparation moves that work to index replacement rather than every keystroke.
These are local operation counts and Node microbenchmarks, not browser frame,
CPU, memory or whole-app speed measurements. Reminder filtering still runs on
the 30-second cadence. Integrations retain their existing polling schedules.

### Validation

Python API tests include ETag/304 reuse and uncached private/error responses.
JavaScript regression tests cover reminder deadlines, completed reminders,
cross-tab races, direct store invalidation, failed writes/reads, polling fallback,
search ranking equivalence and deferred/stale search rebuilds, video deferral,
duplicate loads, cancellation, resuming and source release. Existing backend,
timer, weather, task, search and wallpaper tests also pass. The source build
checks JavaScript syntax and local asset references.

Full browser verification remains outstanding: this session's sandbox rejected
binding the isolated test server and launching headless Chrome. No browser
capture-suite pass, visual check, real microphone check, device check or live
account performance is claimed. No private settings/data were used or changed.

Final results: **70 Python tests and 44 Node tests passed**, along with the source
build, JavaScript syntax/local asset checks and `git diff --check`. Python reports
the existing Starlette/AnyIO deprecation warning. The passing Node count includes
four legacy Spaces-store tests; that module remains unloaded, as before.
