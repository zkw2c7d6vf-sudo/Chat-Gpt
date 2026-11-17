# Version 2

Built around a centered clock and a compact utility row for Spotify, weather and the candle warmer. Calendar and Daily Read receive most of the screen. Removed slogans, panel eyebrow captions, connection footnotes and other decorative subtext from the dashboard; retained actual metadata, actions, required weather attribution and actionable errors. Setup explanations stay inside Settings.

- Record tonearm is an SVG entirely inside the turntable bounds; it cannot reach the title. Album name appears beside the artist.
- Candle warmer uses one SVG with a connected support, shade and base.
- Spotify mark is the official green primary logo, downloaded from [Spotify’s brand assets](https://newsroom.spotify.com/media-kit/logo-and-brand-assets/). Asset: https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png. Spotify retains ownership of its mark.
- RSS previews use images supplied by the feed (media thumbnails, media enclosures or embedded image references). Missing, blocked, oversize or unsupported images show a neutral fallback. The backend validates public HTTPS destinations, pins DNS for each connection, restricts previews to configured feeds, and serves raster formats only. No article-page scraping or paid image service.
- The calendar includes a fourteen-day strip with event dots. Clicking a date scrolls to its first upcoming event; the larger agenda shows more events before scrolling.

References reviewed for general layout ideas, not copied assets or code:

- [DAKboard screen layout options](https://dakboard.freshdesk.com/support/solutions/articles/35000326827): give calendar/news blocks useful space and reduce competing blocks when more dates need to be visible.
- [MagicMirror default modules](https://docs.magicmirror.builders/modules/introduction.html): separate clock, calendar, weather and news into focused modules. [News module](https://docs.magicmirror.builders/modules/newsfeed.html).

This app remains local and free to run. Saved connections and account data are excluded from distributable archives.

# Version 3

Full-width canvas with a significantly larger centered clock. The left header is a persistent focus timer; theme selection, Settings and fullscreen sit on the right. The eight palettes use semantic CSS variables for backgrounds, text, panels, controls, dialogs, illustrations, sky/hills, timer rings and record outlines. Christmas combines forest green, warm gold and red accents with slow snow. Rainy day uses blue-gray tones and rain streaks. Daylight has a separate light palette with dark text. Decorative motion stops under reduced-motion preferences.

The Spotify release-year badge stays beside the artist/album metadata. Centered SVG play/pause glyphs replace font-dependent symbols; the upper-right Playing/Paused indicator also works as a playback button. Spotify’s [release date field](https://developer.spotify.com/documentation/web-api/reference/get-an-album) refers to the reported album/release and can differ from the original song year.

Forecast details use current, hourly and daily fields from [Open-Meteo](https://open-meteo.com/en/docs). The reader uses [Trafilatura](https://trafilatura.readthedocs.io/en/latest/usage-python.html) for local extraction of public HTML into text, with an explicitly labeled feed-text fallback. No article HTML is inserted into the dashboard DOM.

# Latest refinement

Moved Focus into its own card and arranged the utility row as Spotify, weather, focus and warmer. The wider weather card includes seven miniature forecast cells. Moved appearance controls into Settings, with Settings/fullscreen alone in the top-right corner. Added four local system-font stacks for numeric elements.

Both seasonal themes now use native CSS cloud layers and a day/night sky. Christmas includes an original SVG tree visible behind translucent panels; all seasonal artwork is local and does not require image downloads or paid services. The cloud scene uses transform animations, tree lights use opacity, and reduced-motion settings stop the effects. The candle/lamp and record-arm materials are intentionally fixed to natural colors across palettes.

# Instant Capture and project direction

Midnight continues Orbit as a personal daily-life dashboard. Capture and Inbox are first-class header actions, available without setting up room devices, Spotify or calendars. The main clock, card arrangement, navy/mint palette and all existing themes are retained. The project-wide rules live in `AGENTS.md`: repeated critical actions within two taps, one-time minimal setup and local usefulness without internet.

Basic capture is Open → Save after entering text. Inbox → Edit/Done/Archive keeps organization one panel away. Optional type/date input does not block a quick note. A global keyboard shortcut can stack Capture over existing panels without discarding unsaved settings. The large keyboard follows the current semantic theme; global focus indicators and minimum action heights also improve the older panels.

IndexedDB keeps captures and draft transactions independent of network integrations; only completed transactions report success. Notes are local to the browser profile/origin, with an explicit export option and storage explanation inside Inbox. Reminders are due-state records checked while the page is open, with overdue recovery on the next visit. They do not imply an OS background scheduler.

Voice requires on-device recognition and a user-triggered free language-pack download when needed. It never selects cloud recognition as a fallback. Implementation follows the browser's [on-device speech APIs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API). Unsupported browsers retain full keyboard capture, plus an explanation of system dictation. Final results are drafted; temporary speech stays visibly separate.

# Four-pass desktop refinement

The target is desktop monitors and desktop touchscreens. Phone layouts are outside the
user's intended use. Compact desktop windows may scroll; 1080p and typical laptop sizes
keep a stable dashboard with a centered clock and quiet semantic surfaces.

1. Structure and Focus: reproduced card intersections at 1280, 1366 and 1440px. The Focus
   card's minimum height exceeded the allocated row. Replaced implicit placement with
   named grid areas and simplified the card to the time, duration action and Start/Pause.
   Presets remain one panel away inside the custom-duration picker.
2. Reading and hierarchy: balanced the utility row, aligned card spacing and icon strokes,
   added forecast weekday labels and selected calendar-day state, improved text sizing,
   and removed empty image placeholders from feed stories without images.
3. Capture and Inbox: a larger writing area, segmented capture types, quieter keyboard,
   transaction-confirmed draft status, direct task completion, sticky search with Clear,
   quieter item actions and compact ChatGPT/storage guidance. Existing capture storage,
   reminders, draft recovery, export and explicit manual ChatGPT handoff remain intact.
4. Consistency and resilience: removed duplicated theme selection UI, made warmer setup
   a direct action, checked light/dark/seasonal surfaces, reduced motion, short desktop
   windows and long content. Cache version v3 keeps the cached HTML and assets together;
   cache misses can fall back to the local server.

Review images for all four checkpoints live in `verification/design/`. They use synthetic
integration data. Final images are named `pass4-*`. Earlier full-page screenshots had
browser capture artifacts; final dashboard images use fresh browser contexts and viewport
captures. Layout checks use DOM geometry independently of screenshot output.
