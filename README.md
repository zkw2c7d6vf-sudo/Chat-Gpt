# Orbit 4.5.2

4.5.2 removes per-move layout saves and panel rerenders from dragging, reduces the dock to daily Home tools plus Backgrounds, and adds a visible search field on every screen size. [Interaction details](docs/home-performance-review.md).

Home has been rebuilt around the supplied scene-first reference: a full-screen navy landscape, compact icon rail, three initial panels and an on-demand tool dock. [View the screenshots and design changes](docs/home-rebuild-review.md). Earlier layouts remain stored separately.

Orbit is Joe’s local personal dashboard. Version 4.5 combines immersive Home, a weekly Planner, Education Center, File Studio, media, shopping, finance, and the existing provider connections.

## Install 4.5 without replacing your current copy

1. Export a dashboard backup from your current Orbit’s Profile & settings.
2. Stop the old server with **Control + C**. Extract this download into a **separate folder** and keep the old folder intact.
3. Privately copy your existing **`.env`** and **`.orbit`** folder into the new folder. Keep a custom `DASHBOARD_DATA_DIR` unchanged if you use one. Finder’s **Command + Shift + .** shows hidden files. Do not copy `node_modules`.
4. Open Terminal in the new folder and run the commands below. Continue using **the same browser and `http://127.0.0.1:5173`** to keep origin-scoped notes, tasks, media, and sessions.

Your Mac is not updated automatically by a GitHub push. This release never replaces an existing installation for you.

## What is new in 4.5

- **Immersive Home:** eleven directly movable/resizable windows, minimize/dock, close/reopen, maximize/restore, keyboard controls, saved Today/Study/Focus/Unwind layouts, and searchable backgrounds. Every widget reveals additional data or working controls when expanded. `?classic-home=1` preserves the classic layout.
- **Education Center:** create, edit, search, complete, reopen and remove college/teaching responsibilities with course, type, date, notes and resource link. Deadlines appear in Home’s Up next and the weekly Planner. Records remain in this browser and are excluded from AI context.
- **Weekly Planner:** calendar events, dated tasks, education deadlines and an unscheduled task list. Drag local tasks onto a day or use the date inputs. Events remain read-only.
- **Tasks:** edit titles, due dates and priority, filter open/due/completed entries, and undo deletion. Home compact view shows three open priorities.
- **Focus:** persistent deadlines across navigation/reload, intentions, completed-session history, genuine volume control, and shared ambient audio. After a reload, resume sound explicitly; the timer continues without autoplay.
- **File Studio:** local PNG/JPEG/WebP conversion, resizing and quality controls; JSON formatting/minification and CSV ↔ JSON. Preview and download outputs without uploading them. PDF, Office and video conversion are outside this build.
- **Shopping Scout:** save live eBay listings into the comparison board, filter by USD delivered budget, sort, and reopen saved searches. Unknown shipping is labeled and excluded from delivered-price comparisons. Existing manual retailer comparisons still work.
- **Backups:** Education Center, focus preferences/history, saved YouTube IDs, finance, shopping and Home layout are included. Tokens, private calendar URLs, media bytes and private background bytes remain excluded. Running timer deadlines and temporary File Studio inputs are not portable backup data.

Release details and the tested widget matrix: [4.5 handoff](docs/v4.5-review.md). Start future coding work with [CODEX_START_HERE.md](CODEX_START_HERE.md) and [ORBIT_STATUS.md](ORBIT_STATUS.md).

## Start on your Mac

Use Node.js 24 or later. Open the project folder in Terminal, then run:

```sh
npm ci
npm run dev
```

Keep Terminal running and open the app at `http://127.0.0.1:5173`. The web app uses port **5173**, forwarding `/api` requests to the API on port **3001**. Local calendar imports also work through `http://localhost:5173`, but use `127.0.0.1` consistently for Spotify because its registered callback requires it.

## v3.3: readability and shopping comparison

v3.3 increases everyday text sizing, makes the local clock more prominent, and adds a time-of-day icon. Calendar imports remain private and server-backed. If a calendar import reports a dashboard-origin error, stop any older Orbit Terminal windows, start this copy with `npm run dev`, then open `http://127.0.0.1:5173`.

Shopping Scout now saves searches and lets you save actual listings from Amazon, Walmart, Target, Depop, or Vinted with item price, shipping, link, and note. It sorts the listings you save by delivered total. It does not scrape stores or claim a live web-wide lowest price. Orbit’s product principles are in [design-philosophy.md](docs/design-philosophy.md).

## v4.1: focus, watch, shop, and settings

Orbit 4.1 refines the dashboard around four practical surfaces:

- Focus offers 5, 10, 25, 50, or custom-minute sessions with browser-generated rain, roof, window, storm, snow, and hail soundscapes. Audio only starts after the user starts a session.
- Media opens with TVMaze catalog picks, keeps cast and IMDb exploration, and places the YouTube player and a grid of official streaming-service links in the lower player area.
- Shopping Scout requests live product cards through an optional private eBay Browse API connection. Without those credentials it shows a clear setup state and keeps saved searches, retailer links, and manual delivered-price comparisons available.
- Profile and settings are consolidated into the wide page opened by the bottom-left Joe avatar. The duplicate Connections sidebar destination is removed.

The overview status strip only shows the event count when a calendar is connected; calendar setup guidance remains inside the calendar and profile surfaces.

## v4.2: finish and refine

Orbit 4.2 tightens focus timer controls and copy, and expands the animated rain layer across the full focus card while keeping the timer controls readable above it. The feature set was reviewed across the API, browser, media, shopping, calendar, weather, and local storage flows; the existing regression checks cover connected and disconnected states, imports, playback, shopping comparisons, and responsive layouts.

## v4.3: Today, Planner, and Finances

The overview has a compact daily brief with the next event, up to three priority tasks, open task count, and a prominent current temperature. The weather panel shows only a seven-day forecast; location and units are changed in profile settings. Planner combines the existing calendar with tasks and optional due dates and priority labels. Finances is a separate private section for manually entered income and expenses. Entries stay local, are included in Orbit backups, and do not appear on the overview. No bank connection or paid service is required.

## v4.4: Google recovery and service polish

Google errors now identify whether Calendar, Gmail, or Drive needs its API enabled or its consent scopes refreshed. A failed Google service remains isolated so the other connected panels can still load. See the [v4.4 review](docs/v4.4-review.md) for the seven-pass audit.

## v4.0: watch and discover

Media Center includes a TVMaze-powered show search with catalog images, cast cards, IMDb links, and an optional Rotten Tomatoes rating lookup through OMDb. Without `OMDB_API_KEY`, the ratings row explains that the provider is not configured; Orbit never fabricates a score. Add `OMDB_API_KEY` privately to `.env` and restart the API to enable it.

The same media area includes a YouTube no-cookie player and local saved video IDs. Tubi and Pluto TV are offered as external search links because those services control their own playback, availability, and embedding permissions; Orbit does not bypass their restrictions. The local library and native browser player remain available for files you own.

Shopping listing cards can include a product image URL copied from the retailer’s listing page. Images are displayed directly by the browser and remain optional; Orbit does not proxy or scrape retailer pages. Saved comparison data is included in validated dashboard backups.

To show live product cards in Shopping Scout, create an eBay developer application and add its private `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` to `.env`. Orbit uses eBay’s Browse API server-side and never exposes those credentials to the browser. Without them, the saved-search and manual comparison tools still work and the app explains why live inventory is unavailable.

Focus now has an optional contained rain animation and browser-generated rain noise. It requires a user click to start audio, runs only while the focus session is active, and respects reduced-motion settings.

For a restricted cloud workspace, use `npm ci --cache /tmp/orbit-npm-cache` instead. No Git worktree is needed: use the existing checkout.

## Upgrade from your downloaded V1

Updating this repository does **not** update the copy running on your Mac automatically. If you originally downloaded a ZIP:

1. Stop Orbit with **Control + C** in its Terminal window.
2. Keep your existing project folder as a backup. Download and extract the updated project into a separate folder.
3. Copy your private **`.env` file** and **`.orbit` folder** from the old project into the new one. In Finder, **Command + Shift + .** shows hidden files. If you set a custom `DASHBOARD_DATA_DIR`, keep using that location instead.
4. Open the new folder in Terminal and run `npm ci`, then `npm run dev`. Install dependencies fresh rather than copying `node_modules` between versions.
5. Open the same `http://127.0.0.1:5173` origin in the same browser. Keep its site data and cookies to preserve the existing Spotify session and browser-stored tasks/notes.

Do not replace your existing `.env` with `.env.example`: the example has empty credentials. Never upload `.env` or `.orbit` to GitHub or share their contents in chat. Reconnect Spotify only if the session has expired or the connection is no longer available.

## Calendar without Google Cloud

V2 accepts a **read-only calendar subscription URL** (an ICS/iCalendar feed) in **Settings / Connections**. Google OAuth is optional for this route.

For Google Calendar, open that calendar's settings, find **Integrate calendar**, and copy its **Secret address in iCal format** if your account provides one. Paste it directly into Orbit's calendar connection field. Other providers may call this a subscription, iCalendar, ICS, or `webcal://` link.

**Treat a private ICS URL like a password.** Anyone who has it may be able to read that calendar. Do not paste it into this chat, commit it, or make your calendar public just to connect Orbit. If your calendar provider or organization does not offer a private feed, use its `.ics` export and import the file into Orbit instead. A file import is a snapshot; importing a newer file updates it. A subscription can be refreshed from the provider. Orbit caches fetched feeds for five minutes and displays up to 200 events in the upcoming 14-day window; recurring and all-day events are parsed from the feed. An import accepts an ICS file up to 2 MiB.

The calendar feed connects your **calendar only**. It cannot unlock Gmail, Google Drive, event editing, or email sending. If Google was already connected, a configured ICS calendar takes precedence for the calendar while the Google connection can continue to supply mail and Drive metadata.

The Google Cloud free-trial/billing promotion is separate from this calendar-feed route; you do not need to sign up for it to use an ICS subscription. A calendar provider may still impose its own account or sharing restrictions.

## Weather

The weather panel defaults to **Buffalo, New York**. Search for another city to change the location, and switch between Fahrenheit and Celsius. Weather is retrieved from **Open-Meteo**; it does not require an API key. The selected location and units belong to this browser. City searches and weather coordinates are sent to Open-Meteo, not your account credentials. Weather errors are shown explicitly rather than replaced with invented conditions.

## Spotify

Your existing Spotify setup still works. The private configuration uses:

```dotenv
APP_URL=http://127.0.0.1:5173
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
DASHBOARD_DATA_DIR=.orbit
```

These are placeholders. Keep real credentials in `.env` or private server environment settings, never in source code or a `VITE_` variable. For a new Spotify app, register this exact callback:

```text
http://127.0.0.1:5173/api/auth/spotify/callback
```

Spotify requires an explicit loopback IP such as `127.0.0.1` for HTTP development callbacks; do not substitute `localhost`. The configured `APP_URL`, browser origin, and registered callback must match. In Orbit, select **Connect** beside Spotify and authorize the account.

The app requests `user-read-currently-playing`, `user-read-playback-state`, and `user-modify-playback-state`. Playback controls require an eligible Spotify Premium account and an active device. Start a song in Spotify first. Orbit controls playback through Spotify; it does not stream music itself. Spotify's current developer-account and authorized-user restrictions still apply.

## Talk to Orbit

The optional sidebar assistant provides typed prompts and supported browser dictation. Review dictated text before sending; typed messages remain available when voice is unavailable.

Voice requires microphone permission and a supported browser. Use the local development origin above, or HTTPS when hosted. If permission was previously denied, allow the microphone in the browser's site settings and retry. On a Mac, also check System Settings → Privacy & Security → Microphone. As another option, enable macOS Dictation under System Settings → Keyboard and use its configured shortcut while the message field is focused. Native browser speech recognition may send audio to the browser vendor's speech service under that vendor's terms. Recorded transcription, when available and explicitly started, uses the configured OpenAI API service instead.

Without an AI key, Orbit remains a local dashboard guide: it can summarize the loaded day and tasks, navigate to the inbox/files, start or pause focus sessions, and add a task with a command such as `Add task: Book a dentist appointment`.

Optional conversational AI requires a **separate OpenAI API account/key and API billing**. Set `ORBIT_AI_KEY` (or the compatible `OPENAI_API_KEY`) privately; `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Recorded transcription uses `gpt-4o-mini-transcribe` and accepts up to 10 MiB per recording. A ChatGPT subscription does not automatically supply API access. Signing into this ChatGPT app does not sign Orbit in, and Orbit cannot inherit this conversation, saved ChatGPT memory, or the assistant's tools. The build handoff in [docs/v2-handoff.md](docs/v2-handoff.md) documents our starting point. The app sends its bundled `buildHandoff` summary from `src/data.ts` as context; it does not read the Markdown file automatically.

When enabled, AI requests send your question, a bounded recent conversation history, and the dashboard context supplied by the app to OpenAI. That can include calendar details, tasks, important-email sender/subject summaries, and the build handoff. It does not grant background access to your Mac or ChatGPT. Private notes and Drive file contents are not part of the standard context. AI advice does not send mail or edit calendar events; explicit task and focus commands run locally.

## Tasks and continuity

V2 begins with a build checklist based on this conversation, including the Spotify connection the user reported as working and the calendar/weather/voice follow-ups. It does not invent a personal life backlog.

Tasks, notes, and V2 conversation messages live in this browser's local storage. Clear conversation history from the assistant when desired; clearing browser site data also removes it. Existing user tasks are preserved during upgrades. You can add, complete, and remove tasks, including through supported local assistant commands. With AI configured, **Review next steps as we talk** queues up to three concrete suggested actions per reply for approval before adding them to this browser’s list; this setting is enabled for the requested ongoing tracking and can be turned off in Assistant settings. Review or delete any suggestion. The assistant only knows the data provided to it by this app and the saved build handoff; it does not automatically read future conversations in ChatGPT. Future coding work must explicitly update the handoff/checklist, or you can add the task directly in Orbit.

Opening an email only updates Orbit's local read marker; Gmail is unchanged. Search covers the loaded events, messages, files, and tasks, not your entire account. Unconnected services show connection prompts and empty states by default. Optional demo mode uses clearly labeled sample content rather than claiming to be connected.

## Optional Google mail and Drive connection

If you later want the live Gmail and Drive panels, Google OAuth remains available. Create a Google OAuth web client, enable the Calendar, Gmail, and Drive APIs, and register:

```text
http://127.0.0.1:5173/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` privately, restart Orbit, then connect Google. Apps in testing need your account added as a test user. Orbit requests `calendar.readonly`, `gmail.readonly`, and `drive.metadata.readonly`; it does not send mail or modify your Google content. Revoke access in your Google account settings whenever desired. This optional integration is independent of the private ICS calendar route.

## Private storage and deployment

This is a **single-user personal dashboard**. Private server data is stored in `DASHBOARD_DATA_DIR`, defaulting to `.orbit` within the project. That folder is excluded from Git, created with `0700` directory permissions and `0600` credential-file permissions. Do not use the old cloud-specific `/workspace/.orbit-private` path on a Mac. Preserve your configured data directory and session cookie to retain connections; keep it out of shared backups.

The API binds to `127.0.0.1` by default. `HOST=0.0.0.0` is available when intentionally exposing it behind a trusted proxy. A public deployment needs application authentication, HTTPS, appropriate access controls, and secret/session management. OAuth alone does not protect access to the dashboard itself. Disconnecting removes Orbit's stored connection; revoke the grant at the provider too if you want to withdraw it completely.

For a production build:

```sh
npm run build
APP_URL=http://127.0.0.1:3001 npm start
```

The built app and API are served together on port **3001**. Register matching OAuth callback URLs for that origin, or use your actual public HTTPS origin. `npm run preview` only inspects the static frontend; use the full API server for connections and weather.

Cloud environment settings can inject server variables instead of a `.env` file. Saving an environment draft does not apply its settings or publish the application.

## Checks

```sh
npm run build
npm test
# With npm run dev running in another terminal:
npm run test:e2e
```

The build checks TypeScript and produces the frontend. Server/browser tests can exercise provider behavior through mocks without account credentials. Live provider access still requires your own authorized accounts and working network access. A passing mock does not prove live Google, Spotify, weather, or OpenAI access.

The browser suite uses system Chromium when available, or Playwright's installed browser otherwise. Run `npx playwright install chromium` if needed; `CHROMIUM_PATH` selects another Chromium executable.

### Run V3 without replacing V2

Download the `orbit-v3` branch ZIP into a **separate folder**. Keep your existing V2 folder unchanged. In the V3 folder run `npm ci` and `npm run dev` after stopping V2's server (both use the same ports). The updater refuses to overwrite an installation reporting V2. Do not merge V3 files into your working V2 directory.

If you choose to reuse configured accounts, privately copy your existing `.env` and `.orbit` folder into the separate V3 directory. These are hidden files in Finder (Command+Shift+period shows them). Never upload them or paste their contents into chat. Keep the same configured origin for OAuth; browser tasks/notes also belong to that origin. Export a dashboard backup before trying V3 because the two versions at the same browser origin share local text storage. Media bytes stay in that browser's IndexedDB and are not part of the text backup.

## V3 additions

Development is isolated on `orbit-v3`; `main` retains V2. Nothing is publicly deployed.

**Media Center** adds Movies, TV, Photos, and a built-in Player for compatible personal files. Files are stored locally in this browser's IndexedDB, not uploaded to Orbit's server. Keep originals: browser storage can be cleared or evicted. Codec support depends on the browser; the player explains unsupported files. Use Tonight’s queue, favorites, and continue-watching progress. No subscription-streaming or DRM bypass is included.

**Shopping Scout** saves local searches and opens those searches at Amazon, Walmart, Target, Depop, and Vinted. It can request a live eBay Browse feed when the private eBay credentials are configured; otherwise it keeps the explicit saved-search and manual comparison workflow. Orbit does not scrape retailer sites, access shopping accounts, or claim a web-wide lowest price.

**Quick capture** (top bar, or Ctrl/Cmd+Shift+K) saves tasks, notes, ideas, responsibilities, reminders, financial goals, and habits locally. The Daily Command Center displays three priorities from your entered responsibilities and tasks. School/teaching details and financial targets start empty; Orbit does not invent those details or connect a bank. Reminders appear in the app, not as background notifications. Habit checks use the current local day.

**Approval & activity** holds AI-suggested tasks for explicit approval. Approved tasks enter your local list; dismissed suggestions stay out. Explicit task commands remain direct user instructions. No external service action is executed by this approval queue.

**Backup & restore** lives in Connections. Review a backup before applying it; it contains private notes/conversation and local settings. It excludes credentials, connection tokens, and media file bytes. Keep original media separately.

Research: [official sources and constraints](docs/v3-research.md). Audit and revision record: [seven V3 passes](docs/v3-revisions.md).

V3 test commands: `npm test` covers backend/backup/updater checks; with `npm run dev` running, `npm run test:e2e` checks preserved V2 workflows and `npm run test:v3` checks new interactions. The V3 browser suite needs FFmpeg to generate tiny test videos plus Chromium/Playwright. Neither FFmpeg nor a paid service is needed to use the app. Media imports currently cap at **500 MiB per file**; keep original files separately.

## V3.1 visual revision

The `orbit-v3.1` branch preserves the V3 and V2 branches. The overview removes the central AI companion and illustrated character, uses a navy space theme with text navigation on desktop, and prioritizes schedule, tasks, weather, music and focus. The local greeting and clock update while the page remains open and address Joe. Filler headings and taglines are shortened. The optional sidebar assistant remains accessible, with no character graphics. Existing data keys and integrations are unchanged; no credentials need to be re-entered simply for this visual update.

Download `orbit-v3.1` into a separate folder to review it. Stop the other Orbit server before starting this one. Follow the private-configuration guidance above if reusing account settings. Keep the same browser origin for existing browser data.

`npm run test:v31` checks the personal greeting, live noon/evening transitions, navigation at five screen widths and saved notes. `npm run test:e2e` and `npm run test:v3` cover preserved functionality. Design review: [v3.1-review.md](docs/v3.1-review.md).
