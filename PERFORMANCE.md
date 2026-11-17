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
