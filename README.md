# Midnight Dashboard

A local dashboard for Mac and Windows. The home is a large clock with Spotify, weather and your next calendar event. A small bottom dock opens Calendar, Tasks, Focus, Room, Read and Inbox as floating panels. Capture and Search have separate controls in the top right.

Appearance defaults to Nature: a muted landscape. Rotating Pixabay clips default to 1080p, with optional 4K. Settings also offers Black, Automatic (the computer’s light/dark setting), Light, Rain and Christmas. Number fonts show real digit previews and update immediately. Silver glass replaces the former navy palette. Spaces and the large Today planning section are removed; existing captures, tasks, deadlines, drafts and integration settings are retained.

## Start Midnight

On Mac, double-click **Start Dashboard.command** in your existing MidnightDashboard folder and keep its window open. On Windows, run **Start Dashboard.cmd**. Open **http://127.0.0.1:8765/app**. If an older version is visible, close the dashboard tabs and reopen it. The server stays local to this computer.

For an existing installation, stop its server, run **Apply Midnight Update.command**, then restart with the original launcher. The update backs up replaced source and preserves settings, connections, browser captures and dependencies. See `CALM-VERIFICATION.md` for this redesign’s checks.

## GitHub source checkouts

The source-only GitHub branch omits large MP4 files. Existing bundled videos are retained when updating. New checkouts use the local still images until Pixabay is configured and a video has been saved. The launchers no longer download videos from the previous provider. `scripts/fetch_assets.py` supports only explicitly listed public Pixabay assets; the default manifest is empty.

## The three main widgets

- **Spotify:** tap the record or device name for Now playing. Seek within the current track, change volume when supported, toggle shuffle and choose repeat. Transport stays on the home card. Reconnect appears only when sign-in has expired. Controls target your existing Spotify player; Premium, app access and supported endpoints are required.
- **Weather:** the condition icon opens today's forecast. Each day opens its own hourly/details panel, now including max wind, UV and precipitation totals. The home includes a qualified rain outlook and clearly separated highs/lows.
- **Up next:** a live countdown and following-event preview keep the card useful at a glance. Tap for notes, time/location, copy and the full calendar. Calendar integration remains read-only.

The bell counts unread notifications from this visit; Inbox counts saved unfinished captures. Counts are intentionally different. Notifications now sit in the upper-right corner, away from the dock. See `WIDGETS-VERIFICATION.md` for checks and integration limits.

## Live backgrounds

Nature and Rain support muted, locally saved landscape videos. Rotation retains the one-to-ten-minute duration range. Playback pauses when the dashboard is hidden and respects Reduced Motion. **Settings → Appearance** keeps all existing themes available. **Play live backgrounds** controls scenery without affecting Spotify.

Pixabay is the only online video provider. Get a free key at https://pixabay.com/api/docs/ and use **Settings → Live backgrounds → Pixabay API key → Save backgrounds**. Leave the field empty to keep a saved key; **Remove key** removes it locally. Credentials live in `data/wallpaper.json` with owner-only permissions where supported, are never returned by settings/bootstrap, and are sent only to Pixabay's video API. The old provider's generic key is ignored and is removed when saving the new settings. No key is included in source, tests or packages.

Rotation defaults to every 30 minutes, with 15-minute, hourly and daily options. **Next scene** switches early. **1080p** is the default and selects actual 1920×1080 renditions, regardless of Pixabay's rendition labels; it never silently substitutes 720p or 4K. Optional **4K when available** retains higher-resolution selection and falls back to 1080p for oversized downloads. Only landscape MP4 files from Pixabay's approved CDN are downloaded. The settings status reports actual resolution and failures.

Search catalogs are cached locally for 24 hours, including across server restarts, as required by the [Pixabay API documentation](https://pixabay.com/api/docs/). No background mass querying is performed. API failures, invalid keys, rate limits and oversized downloads keep the last saved Pixabay clip or a bundled fallback. Up to two clips per theme/quality are retained (eight total, maximum 256 MB per clip). Browser playback uses the local backend; credentials are never sent with video downloads or exposed in error messages.

Previously bundled Nature/Rain videos and stills remain usable offline and retain their original creator credits. That attribution does not enable the retired provider or make network requests. Pixabay clips show their Pixabay creator and source page. See `ASSET-CREDITS.md` for the bundled footage's provenance. New source checkouts initially have stills; after the first successful Pixabay download, the saved video also works offline.

## Instant Capture

Tap **＋ Capture**, type or dictate, and tap **Save**. No account or integration setup is needed for capture. **Ctrl/Command + Shift + K** opens capture from anywhere, including over a reader or settings panel; **Ctrl/Command + Enter** saves. The touch keyboard is shown by default and supports Shift, numbers/symbols, cursor-position editing, emoji-aware backspace, spaces and newlines. Hide it to use a system keyboard.

- Capture a note, task, idea or reminder. Leaving the type as Note is the fastest path; organize later through **Inbox → Edit**.
- Drafts save as you type and restore after closing or reloading. Save waits for a committed local database transaction; failed writes retain your text and show an error.
- Inbox supports text search, type filters, editing, task/reminder completion, archive and restore. Archive is reversible; there is no permanent-delete button.
- Reminders use this computer's timezone. A persistent banner shows due reminders while Midnight is open, including overdue reminders after reopening. Mark them done or archive them to dismiss. No background alarm, email or calendar event is created, and a closed browser cannot alert you.
- Captures use IndexedDB in **this browser profile on the same origin (host and port)**. Prefer `http://127.0.0.1:8765/app` consistently; `localhost`, another browser, private browsing and another PC have separate storage. Clearing site data removes captures. **Inbox → Export backup** downloads readable JSON with saved items and the new-capture draft. Inbox → Restore backup validates a backup, previews it and merges new captures while retaining existing data and drafts.
- Capture, inbox and the focus timer work without internet while the local server is running. Capture does not call external services or depend on successful account/network integrations. The interface must first load from the local server; this is not a cached standalone app when that server is stopped.

### Free on-device voice typing

Tap **Dictate**. Midnight requires browser support for on-device SpeechRecognition (`processLocally`); it never falls back to sending audio to a remote speech service. English (US) is the initial voice language. If a language pack is available to download, the **Download voice pack** button explicitly starts that one-time free download, requiring internet. Then tap Dictate and allow microphone access. Browser/OS permissions and language support vary. If unavailable, use the touch keyboard, physical keyboard or your system's dictation shortcut instead.

The panel distinguishes checking/downloading a pack, awaiting permission, listening, microphone-off, permission denied, missing microphone, no speech and recognition errors. Final recognized phrases enter the draft at the cursor; temporary recognition text is displayed separately. Closing capture, saving, hiding the browser or leaving the page stops the microphone. Review the final text before saving; unfinished interim words are not saved. Recognition permissions/audio quality on the actual Windows touchscreen still require a real microphone check.

## Start on Windows

1. Extract the entire folder onto the Windows PC (do not run inside the zip).
2. Install **Python 3.11** from [python.org](https://www.python.org/downloads/windows/). Include the Python launcher. Windows on Ryzen uses the 64-bit x86 installer.
3. Double-click **Start Dashboard.cmd**. First launch creates a local environment and downloads the pinned dependencies. Keep the console window open. The browser opens when the server is ready.
4. Visit **http://127.0.0.1:8765/app** in Edge or Chrome. Use the dashboard’s fullscreen button or F11. For a second monitor, move the browser window to that screen, then fullscreen it. Use Windows Settings → System → Display → Extend these displays.
5. Press Ctrl+C in the console to stop. Settings remain in `data/`.

Manual alternative in PowerShell from this folder:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe server.py
```

The app binds only to `127.0.0.1:8765`. Do not change it to `0.0.0.0`, add port forwarding, or run it on an untrusted shared PC. No administrator access or inbound firewall rule is required. The touchscreen is just another display attached to this same PC. This is not a remote tablet server.

## Start on Mac

Double-click **Start Dashboard.command**. The first launch uses `uv` if installed, or Python 3.11, to create a local environment and install dependencies. It opens your default browser at **http://127.0.0.1:8765/app**. Keep Terminal open; press Control+C to stop. If macOS does not open the launcher directly, open Terminal and run `zsh ` followed by dragging the launcher file into Terminal, then press Return.

The Mac runs the same app and integrations. Spotify still needs the Client ID/sign-in, calendar needs a URL/file, and the plug requires the Mac to be on its home LAN. Browser location permission may need to be enabled, or use manual coordinates.

## What works, and what needs setup

| Feature | Implemented behavior | Setup / limits |
| --- | --- | --- |
| Clock | Live time/date and greeting; forecast timezone when located, PC timezone otherwise | Uses the PC’s time; enable automatic Windows time |
| Weather | Browser geolocation → Open-Meteo; temperature, feels-like, high/low, day/night and animated rain; 15-minute cache | Grant browser/Windows location access, or enter coordinates in preferences. Requires internet; no API key |
| Spotify | OAuth Authorization Code + PKCE; token refresh; now-playing title/art/artist/device; rotating art disc; play/pause/previous/next; progress and action restrictions | Your Premium account covers Premium. Still requires your own available developer app and Client ID, allowlisting, sign-in and a running Spotify player |
| Kasa EP10 | LAN discovery of the configured IP; read state; explicit on/off commands and verification | Defaults to **192.168.18.154**; disabled until you enable access. Same LAN required. Firmware may require Kasa credentials |
| Calendar | Read-only HTTPS iCalendar subscription or `.ics` file import; next 14 days; recurring events, timezone handling, cancellations and all-day events | Add URL/file. Google/Outlook/iCloud calendar integration is through iCalendar, not account OAuth. Imports are snapshots; subscriptions refresh every 15 minutes |
| News | Up to 12 configurable public HTTPS RSS/Atom feeds, cached 15 minutes; source/date/headline and publisher link | Add feeds in preferences; BBC/NASA convenience buttons. No default feeds or invented headlines |
| Focus | 25-minute local timer, restored after reload | Works immediately, no account |

No sample music, events, headlines, temperatures or plug states are presented as live data. Empty, disconnected and failed connections are explicitly labeled. This is a prototype: the integration code is implemented and mocked tests cover its behavior, but Spotify sign-in and physical hardware need verification on your Windows PC.

## Spotify setup

1. In [Spotify’s developer dashboard](https://developer.spotify.com/dashboard), create or use a personal Web API app if creation is available to your account.
2. Register exactly: `http://127.0.0.1:8765/api/spotify/callback`.
3. Under User Management, add the Spotify account email if required by your app’s allowlist. Enter the app’s **Client ID** in Midnight’s preferences, save, then tap **Connect Spotify**. A client secret is not used.
4. Sign in on Spotify’s own page and accept the playback scopes. The app stores tokens on your PC, never in the browser.
5. Open the Spotify desktop/mobile app and start a song. Midnight controls that existing player through Spotify Connect. It does **not** stream audio or turn the browser into a Spotify device. Speakers/audio come from the selected Spotify player.

Current Spotify development mode requires the app owner to have Premium; new apps are limited to one Client ID per developer and five allowlisted users. Access and endpoint restrictions can change, and Spotify can reject or withhold app creation. Premium alone does not guarantee developer access. Playback controls require Premium and an available player. The UI explains 401/403/404 errors, honors rate-limit cooldowns, and stops disc rotation on pause/error. Podcasts/ads/restricted devices may disallow controls or omit metadata. Polling is every 10 seconds while visible; controls refresh shortly after a command. There is no volume, seek, playlist browsing, or automatic transfer/startup playback.

**Without developer access:** use **Open Spotify** in the footer; the dashboard cannot promise live metadata or controls. There is no paid API workaround built in.

Sources checked November 13, 2026: [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [2026 developer update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [redirect URI rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [playback requirements](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback).

## Kasa candle warmer

Open preferences → confirm `192.168.18.154` → enable local access → save. This only starts **state reads**. Tap the warmer button to send an explicit on or off command. The app never powers it on at launch, never retries a power command, and never simulates successful state. Unknown state disables the control until a read succeeds. A failure after a command means the physical state is unknown; check the warmer before relying on it being off.

Reserve the IP in your router. If discovery fails, confirm the PC and plug are on the same home network (not guest Wi-Fi), that local security software permits the connection, and that the IP has not changed. This uses [python-kasa](https://python-kasa.readthedocs.io/en/latest/topics.html), which supports legacy and newer local protocols. Firmware and authentication vary by device.

If firmware requires Kasa authentication, set environment variables **in the terminal that launches the server**. Do not put a password in the source code, screenshots, browser preferences, or a shared shortcut. PowerShell can prompt without putting the password into shell history:

```powershell
$env:KASA_USERNAME = Read-Host 'Kasa account email'
$kasaSecurePassword = Read-Host 'Kasa password' -AsSecureString
$kasaCredential = New-Object System.Net.NetworkCredential('', $kasaSecurePassword)
$env:KASA_PASSWORD = $kasaCredential.Password
.\.venv\Scripts\python.exe server.py
Remove-Item Env:KASA_USERNAME, Env:KASA_PASSWORD
```

The server passes credentials to the local device; it does not log into the TP-Link cloud. No credentials are persisted by this app. If your firmware is unsupported, the UI reports unavailable; it cannot bypass firmware restrictions. No timer, automatic shutoff, or unattended warming is implemented.

## Weather town names

The weather card heading shows the selected city or town. GPS and unnamed manual coordinates use a bundled local GeoNames lookup instead of a timezone name. It chooses the nearest populated place within 50 km; use the pin and city search to choose a precise place if needed. Unchanged coordinates retain an explicitly selected city through preference saves. No extra geocoding API key or location upload is needed.

## Calendar and RSS

In calendar provider settings, find an iCalendar/ICS subscription/export link. Google Calendar: Settings → your calendar → Integrate calendar → Secret address in iCal format. Outlook: use its available publish/subscribe/export feature; publishing may change calendar sharing, so review the provider’s settings yourself. Or export/import an `.ics` file for a completely local snapshot. Do not make a private calendar public just to use the dashboard.

Paste an **HTTPS** subscription URL (convert `webcal://` to `https://` only if the provider supports HTTPS), or choose an `.ics` file and save. Subscription URLs take priority; clear the URL to use an import. The dashboard never edits or sends calendar invitations. Floating event times use the displayed location timezone. The read-only view covers ongoing and upcoming events through the next 14 days, up to 30 occurrences. Imported snapshots do not sync changes. Complex/provider-specific calendar features may not render exactly as the provider does.

For news, paste one public HTTPS RSS/Atom URL per line. This is a feed URL, not a normal website address. Feed errors are shown per source. Articles use external links; no article HTML or script executes inside Midnight. Public feeds/calendars are limited to 2 MB and redirects are revalidated; private/loopback/reserved servers and nonstandard ports are blocked. Authenticated enterprise feeds and LAN-only feeds are intentionally unsupported.

## Privacy and storage

- Everything personal stays in `data/` on this PC: preferences, Spotify tokens and imported calendar data. Weather coordinates and focus deadline are in this browser’s local storage. The app does not log request URLs or tokens.
- Spotify tokens and secret calendar URLs are stored locally as **plaintext**, with restrictive permissions where supported. Windows security depends on your Windows account/folder access controls. Do not sync/share the `data/` folder. This prototype is single-user and has no separate login or OS keychain integration.
- Spotify, Open-Meteo and your chosen feed/calendar providers receive normal network requests. Album artwork loads from Spotify image URLs. Geolocation coordinates are sent to Open-Meteo only for weather. There is no tracking/analytics or CDN script/font dependency.
- Server guards include loopback binding, Host/Origin checks, CSRF tokens for mutations, PKCE/state validation, content limits and safe public URL fetching with pinned public DNS addresses. They do not protect against malware/other users already running on your Windows account.
- **Disconnect locally** deletes Spotify tokens here. It does not revoke the grant on Spotify; revoke through Spotify’s account Apps page if desired. **Remove calendar data** deletes the local import and subscription. Delete `data/` while stopped to reset server preferences. Clear site data in your browser to remove saved coordinates/timer.

## Verify or develop

Requires Python 3.11. Dependencies are pinned in `requirements.txt`. Tests use a temporary data folder, HTTP mocks and fake Kasa devices; they do not sign in, send external writes, or contact real plugs.

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

On macOS/Linux, create a Python 3.11 virtual environment, install requirements, then run `python server.py`. This is also how the portable backend was tested during development. Windows launcher scripts are provided but require final validation on Windows; the build machine is macOS. No Node/npm build step is required.

[Open-Meteo](https://open-meteo.com/en/docs) is free for non-commercial use and requires attribution, included in the dashboard. Internet is required for first installation and connected services. Clock, focus timer, imported calendar and LAN plug operation work locally once installed; failure of an online integration does not substitute fake data.

## Custom Focus and ChatGPT handoff

Focus keeps its 25-minute, 50-minute and Break presets. Tap Custom, enter a whole number
from 1 to 180 minutes, and tap Start timer. The last custom entry is remembered. Opening
or cancelling the picker preserves the current timer. Submitting replaces it and starts
the new duration. A running session shows quiet visual rainfall without sound. Finishing
shows a dismissible checkmark and a brief confetti animation; it does not take keyboard
focus. Reduced-motion preferences suppress the rain and confetti.

Inbox now offers Copy for ChatGPT on each saved capture and an Open Quick Capture link
to the user's existing pinned chat. Copy, open the chat, then paste and send. This is a
manual handoff, not automatic sync or a promise of ChatGPT memory retention. The clipboard
receives content only after an explicit tap. No capture is uploaded or put in a URL, and
Midnight does not use ChatGPT cookies, accounts, or API credentials.

Research found that the standard Sign in with ChatGPT integration does not grant access
to existing ChatGPT conversations. The app's assistant-side ability to message a chat is
not a runtime integration that Midnight can call. Automatic delivery to that pinned chat
therefore remains unimplemented and requires a separate supported bridge. ChatGPT Memory
also does not retain every detail. Relevant official documentation:

- https://developers.openai.com/siwc/quickstart
- https://help.openai.com/en/articles/8590148-memory-in-chatgpt

`tests/focus-ui.e2e.cjs` adds real-browser checks for these timer and manual handoff flows,
using the same environment variables as the existing browser suites. The service-worker
shell version is now v2; close old Midnight tabs and reopen to activate its cached update.


## Home and tools

Calendar, Tasks, Focus, Room, Read and Inbox open from the bottom dock. The home shows your next event; tap it to open its date in Calendar. Task stars pin up to three tasks inside Tasks. Focus links a task to the persistent timer; Tomorrow keeps an existing deadline. Inbox includes backup preview and merge; existing IDs and drafts are preserved. Capture and Search have separate top-right buttons and keyboard shortcuts.
