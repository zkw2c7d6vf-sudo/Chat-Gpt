# Verification

Verified November 13, 2026 on macOS with Python 3.11.18. Windows launcher supplied for the target Ryzen PC; native Windows execution and touchscreen hardware remain to be checked there.

- **21 automated tests passed**. Coverage includes loopback Host/Origin and CSRF guards, preferences validation, disabled-device isolation, explicit on/off commands and cleanup using fake Kasa devices, failed command state, Spotify PKCE/state/denial/expiry, token refresh, disconnected/no-player/metadata responses, 401/403/404/429 handling, blocked private feed DNS, safe headline links and feed caching/errors, recurring and all-day calendar imports, calendar clearing, weather validation and caching.
- **Browser verified:** settings dialog, save preferences, public RSS preset, live weather at test coordinates 40.71 / -74.01 (New York; not inferred user location), populated news links, focus timer start/stop, disconnected Spotify and disabled Kasa states. No browser console warnings/errors observed during these checks.
- **1080p fit:** measured viewport 1920×1080, document width 1920 and document height 1080 with weather/news populated. News and calendar scroll inside their panels. Also visually inspected the narrow-screen layout.
- **Live read-only checks:** Open-Meteo forecast and BBC RSS loaded successfully. No Spotify credentials supplied or actual OAuth grants made. No real Kasa discovery, power commands, or external service writes performed.
- **Syntax:** JavaScript syntax check passed. Backend imported and served successfully.

The tests do not establish Spotify account eligibility, physical EP10 firmware compatibility, Windows launcher behavior, or final touchscreen operation. Those require the target PC and user setup. The screenshot uses a test location and an explicitly selected public feed; the packaged app starts with no location, feeds, calendar, Spotify tokens or enabled plug access.

## Version 2 — November 14, 2026

- **25 automated tests passed**, including new artist/album metadata, feed thumbnail and embedded-image extraction, preview allowlisting, raster-only output, and rejection of private image destinations. JavaScript syntax check passed.
- Checked the populated app at **1280×800, 1440×900 and 1920×1080**: measured document dimensions match the viewport, with calendar/news scrolling inside their panels. Measured tonearm bounds end before the title begins.
- Verified live artist + album metadata, spinning artwork, official Spotify logo, public RSS picture previews, connected warmer illustration, and calendar date navigation. All four current calendar items were visible at 1440×900 after compaction. No browser console warnings/errors observed in the final checks.
- Existing connection settings and local data were preserved. No playback controls, physical plug power controls, account settings or calendar writes were invoked during verification. Existing plug state was read only.
- The user’s running Mac app was restarted to load the backend changes. Source archive excludes all local account data, tokens, calendar files, environments and caches.

## Version 3 — November 14, 2026

- **32 Python tests passed**, covering the new release-year field, city search/forecast parameters, article allowlist, readable text/cache, feed fallback, plain-text sanitization, subscription marker handling and extraction. Existing security and integration tests still pass. JavaScript syntax check passed.
- **4 timer model tests passed** using Node’s test runner: start/pause/resume/reset; reload and completion once; corrupt-state/invalid-duration handling; migration of the previous focus deadline. No Node runtime is required for the app.
- Browser verified all eight themes by reading changed background, text, panel and weather colors. Christmas persisted after reload. Checked focus start/pause/reset and restored the original idle 25-minute state.
- Verified live BBC article extraction inside the same dashboard tab, city search results without changing the saved location, real hourly/seven-day forecasts, sunrise/sunset and overnight moon icons. Tested °F→°C→°F and restored Fahrenheit. Required forecast/reader information remains legible in the themed dialogs.
- Measured no page overflow at 1280×800, 1440×900 and 1920×1080; a narrow 390px check had no horizontal overflow. Playback SVG and circular button centers match. Sidebar count is zero. The laptop clock measures about 153px at 1440×900 (previously 76px).
- No playback commands or physical plug power commands were invoked during testing. Existing account and device configuration was preserved. The running Mac server was restarted to load the changes; distributable archives exclude account data and browser state.

## Latest layout/theme refinement — November 14, 2026

- Existing **32 backend tests and 4 timer-model tests pass**; JavaScript syntax is valid and control IDs are unique.
- Browser measured the four cards in the requested left-to-right order, all with the same top coordinate. Pages fit 1280×800, 1440×900 and 1920×1080; narrow-screen check had no horizontal overflow. The seven-day strip has seven cells and stays inside the weather card. Clicking a mini-day opens the existing popup with seven forecast days.
- Tested all four number-font choices and verified both clock and timer use the selected family. Monospace selection and Christmas theme survived reload; restored Modern and Midnight after verification.
- Verified identical candle/lamp material and warm-light colors across Christmas, Rainy day, Daylight and Midnight. Cloud layers are visible only in the seasonal themes, tree is present in Christmas, and cloud transform changes over time. Checked the relocated timer’s start/pause/reset controls and restored the idle 25-minute state.
- No real Spotify playback command, calendar write, external account change or plug power command was invoked during verification. Existing local connections were preserved. Updated archive excludes all account data.


## Final refinement — November 15, 2026

- Seven frontend model tests pass: four timer tests plus three date-forecast tests for selecting distinct days, grouping hours by local midnight, night/day icons, and rejecting invalid dates. JavaScript syntax check passed. Backend code was unchanged in this refinement; its 32-test suite passed in the previous update.
- Browser verified a Tuesday mini-forecast opened Tuesday’s temperatures and all 24 of Tuesday’s hours, then Next changed the popup to Wednesday. No overall seven-day list remains in the popup. The location pin opens the separate city-search dialog.
- Verified seven font options, including the added Humanist, Geometric and Book serif families; restored Modern. Checked the photographic tree loads at 1200px natural width and that the large ambient moon/sun element count is zero.
- Checked the existing 1440×900 layout has no page overflow. No browser errors or warnings observed during the functional checks. No plug power or Spotify playback commands were invoked; no external account settings were changed.
