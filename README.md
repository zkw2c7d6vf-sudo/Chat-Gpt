# Orbit

A personal command center for your calendar, important email, recent files, music, and daily focus. Built with React, TypeScript, and Vite, with a small Node.js API for account connections.

## Run locally

Use Node.js 24 or later and npm.

```sh
npm ci --cache /tmp/orbit-npm-cache
npm run dev
```

The explicit npm cache path works in restricted cloud workspaces; you can omit it on your own machine.

The development web app runs on port **5173** and forwards `/api` requests to the API on port **3001**. Keep both processes running; `npm run dev` starts them together.

```sh
npm run build
APP_URL=http://127.0.0.1:3001 npm start
```

The production server serves the built app and API together on port **3001**. Register matching OAuth callback URLs for this origin too, or use your configured public HTTPS origin. `npm run preview` is for inspecting the static build; use the full server for account connections.

## Your data

Orbit starts with clearly marked sample events, emails, and files so you can explore the layout before connecting an account. The Spotify card shows a playlist placeholder until a connected device is playing. Sample content does not come from your accounts. Connecting a service uses its supported authorization flow; Orbit never asks for your account password.

Notes, personal tasks, and the dashboard’s local email-read markers are saved in this browser's local storage. They do not sync between devices or browsers. Clearing site data removes them. Opening an email marks it read within Orbit; it does not change its read state in Gmail. Chat messages and the focus timer are not saved across page reloads.

Use the sidebar to switch between Overview, Calendar, Inbox, and Files. Press **Ctrl/Cmd + K** to search the events, messages, files, and tasks currently loaded into the dashboard. The search does not query your entire Google account.

## Account connections

Copy `.env.example` to `.env`, configure the services you want, and restart the API. Keep `.env` private; it is excluded from Git. Leave unused services unset to continue using the dashboard without them.

In a Codex cloud environment, you can also provide the client IDs, client secrets, and `APP_URL` securely through environment settings; a local `.env` file is not required when those variables are injected. The saved draft includes setup/start instructions and the Google/Spotify requirements. Saving a draft does not apply its settings or publish the environment.

Set `APP_URL` to the exact origin you open in the browser, for example `http://127.0.0.1:5173` for local development. Use your public HTTPS origin when deploying behind a proxy. The browser, callback, and configured origin must match. `PORT` defaults to `3001`. The API binds to `127.0.0.1` by default; set `HOST=0.0.0.0` only when your hosting setup requires it, with appropriate access controls.

```dotenv
APP_URL=http://127.0.0.1:5173
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

These are placeholders, not working credentials. Enter real values only in private server configuration.

Provider-specific configuration is described below. Credentials belong on the server, never in browser code or a `VITE_` environment variable. If you deploy the app, use your hosting platform's secret settings instead of committing a configuration file.

### Google Calendar, Gmail, and Drive

Create an OAuth web client in Google Cloud, configure its consent screen, and enable the Google Calendar API, Gmail API, and Google Drive API. While the Google app is in testing, add your Google account as a test user. Register this authorized redirect URI for local development:

```text
http://127.0.0.1:5173/api/auth/google/callback
```

For deployment, replace the origin with `APP_URL`.

Orbit requests `calendar.readonly`, `gmail.readonly`, and `drive.metadata.readonly`. The dashboard displays your schedule, message metadata, and recent Drive file metadata. It does not send email or edit your calendar or files. Revoke access through Google's account permissions page whenever you want.

### Spotify

Create an app in the Spotify developer dashboard and register this local redirect URI, or its equivalent under your public `APP_URL`:

```text
http://127.0.0.1:5173/api/auth/spotify/callback
```

For HTTP development callbacks, Spotify requires an explicit loopback IP such as `127.0.0.1`; do not substitute `localhost`. Open the app using that same origin before connecting.

Orbit requests `user-read-currently-playing`, `user-read-playback-state`, and `user-modify-playback-state`. Spotify account and development-mode eligibility restrictions still apply; account access is governed by Spotify's current developer requirements.

Playback controls require an eligible Spotify Premium account and an active Spotify device. Open Spotify on your phone or computer first. The dashboard controls playback through Spotify; it does not stream audio itself.

### Assistant and voice

Without an AI key, Orbit is a local dashboard guide. It can show your inbox or files, summarize the loaded day or tasks, start a focus session, and add a task with a command such as `Add task: Book a dentist appointment`. These responses run in the browser and use the displayed data, including clearly identified samples when Google is disconnected.

Optional AI responses use a server-side `OPENAI_API_KEY`; `OPENAI_MODEL` defaults to `gpt-4.1-mini`. When enabled, an assistant question sends that question, up to 12 recent conversation messages, and dashboard context to OpenAI: today’s event details, your task list, and important-email senders and subjects. Private notes and Drive contents are not included in this context. Explicit add-task and start/pause-focus commands are handled locally even when AI is enabled. AI responses provide advice and summaries; they do not send mail, edit calendar events, or execute service actions. An unconfigured AI service must not be mistaken for a live model connection.

Microphone input and spoken responses depend on browser support and permission. Use HTTPS in deployment, or a browser-supported local development origin. Text remains available when voice is unavailable. Browser speech recognition may send audio to the browser vendor's service under that vendor's privacy terms.

## Security and deployment

This is a **single-user personal dashboard**. Account credentials are stored outside the checkout in `DASHBOARD_DATA_DIR` (default `/workspace/.orbit-private`), using a `0700` directory and `0600` credential file. Set a private, persistent location appropriate to your deployment. Credentials are associated with a random HttpOnly, SameSite browser session cookie; treat both the server data and browser session as sensitive. Do not expose this app to the public internet without adding application authentication and an appropriate session and secret-management design. HTTPS and OAuth account authorization alone do not protect access to the dashboard itself.

Use read-only Google permissions and grant only the Spotify playback access you want. Disconnecting a provider removes Orbit's locally stored credentials; revoke the app at the provider as well if you want to withdraw its authorization completely.

## Checks

```sh
npm run build
npm test
# With npm run dev running in another terminal:
npm run test:e2e
```

The build performs TypeScript checks and produces the production frontend. Server tests cover the local API behavior available without external account credentials. Live integration validation requires connecting your own accounts; a successful local build does not verify Google or Spotify access.

The browser suite checks desktop/mobile views, keyboard search, task and note persistence, timer behavior, voice-control interactions, and mocked connected-service responses. It uses system Chromium when available; otherwise install a browser with `npx playwright install chromium`. Set `CHROMIUM_PATH` to use another Chromium executable. Real provider access is not replaced by those mocked checks.
