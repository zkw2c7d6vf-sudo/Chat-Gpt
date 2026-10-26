# Orbit v3.2

A personal command center for calendar, important mail, Spotify, weather, tasks, local media, and personal planning. Built with React, TypeScript, Vite, and a small Node.js API.

## Start on your Mac

Use Node.js 24 or later. Open the project folder in Terminal, then run:

```sh
npm ci
npm run dev
```

Keep Terminal running and open the app at `http://127.0.0.1:5173`. The web app uses port **5173**, forwarding `/api` requests to the API on port **3001**. Local calendar imports also work through `http://localhost:5173`, but use `127.0.0.1` consistently for Spotify because its registered callback requires it.

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

**Shopping Scout** saves local searches and opens those searches at Amazon, Walmart, Target, Depop, and Vinted. It does not scrape retailer sites, access shopping accounts, create an algorithmic feed, or claim a live lowest price. A true comparison feature needs authorized retailer/catalog feeds.

**Quick capture** (top bar, or Ctrl/Cmd+Shift+K) saves tasks, notes, ideas, responsibilities, reminders, financial goals, and habits locally. The Daily Command Center displays three priorities from your entered responsibilities and tasks. School/teaching details and financial targets start empty; Orbit does not invent those details or connect a bank. Reminders appear in the app, not as background notifications. Habit checks use the current local day.

**Approval & activity** holds AI-suggested tasks for explicit approval. Approved tasks enter your local list; dismissed suggestions stay out. Explicit task commands remain direct user instructions. No external service action is executed by this approval queue.

**Backup & restore** lives in Connections. Review a backup before applying it; it contains private notes/conversation and local settings. It excludes credentials, connection tokens, and media file bytes. Keep original media separately.

Research: [official sources and constraints](docs/v3-research.md). Audit and revision record: [seven V3 passes](docs/v3-revisions.md).

V3 test commands: `npm test` covers backend/backup/updater checks; with `npm run dev` running, `npm run test:e2e` checks preserved V2 workflows and `npm run test:v3` checks new interactions. The V3 browser suite needs FFmpeg to generate tiny test videos plus Chromium/Playwright. Neither FFmpeg nor a paid service is needed to use the app. Media imports currently cap at **500 MiB per file**; keep original files separately.

## V3.1 visual revision

The `orbit-v3.1` branch preserves the V3 and V2 branches. The overview removes the central AI companion and illustrated character, uses a navy space theme with text navigation on desktop, and prioritizes schedule, tasks, weather, music and focus. The local greeting and clock update while the page remains open and address Joe. Filler headings and taglines are shortened. The optional sidebar assistant remains accessible, with no character graphics. Existing data keys and integrations are unchanged; no credentials need to be re-entered simply for this visual update.

Download `orbit-v3.1` into a separate folder to review it. Stop the other Orbit server before starting this one. Follow the private-configuration guidance above if reusing account settings. Keep the same browser origin for existing browser data.

`npm run test:v31` checks the personal greeting, live noon/evening transitions, navigation at five screen widths and saved notes. `npm run test:e2e` and `npm run test:v3` cover preserved functionality. Design review: [v3.1-review.md](docs/v3.1-review.md).
