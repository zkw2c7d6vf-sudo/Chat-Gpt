# Midnight

A local dashboard for Mac and Windows: a quiet clock-first home, Spotify, weather and upcoming events, with floating Calendar, Tasks, Focus, Read, Inbox and settings tools. The current source is on the **[midnight branch](https://github.com/zkw2c7d6vf-sudo/Chat-Gpt/tree/midnight)**.

## Start

Requires Python 3.11. On Mac, run **Start Dashboard.command**. On Windows, run **Start Dashboard.cmd**. The launcher creates a persistent environment and installs the hashed dependency lock when setup is needed. Open **http://127.0.0.1:8765/app** and keep Midnight running locally. Never expose the server to your network or the internet.

A clean clone includes still backgrounds and their credits. Included MP4s are optional and are not stored in Git. Existing installed footage is retained during updates. Configure a free Pixabay key in Settings to download rotating landscape clips; Pixabay is the only online video provider. Included footage/still credits remain attributed to their actual creators/providers in **Scenery info** and [ASSET-CREDITS.md](ASSET-CREDITS.md).

## Local tools

- **Capture:** open Capture, type, and Save. Ctrl/Command+Shift+K opens Capture, Ctrl/Command+K opens Search, and Ctrl/Command+Enter saves. Notes, ideas, tasks and reminders stay in this browser address, in IndexedDB. No account is required. Completion, archive and edits merge without overwriting unrelated actions from another window.
- **Inbox:** search, edit, complete, archive and restore. Version 2 backups include new and edited drafts; restore accepts versions 1 and 2 and keeps existing captures/drafts. Large collections render in pages of 100. Export/restore when moving to another browser or address; `localhost` and `127.0.0.1` have separate browser storage.
- **Touch/voice:** automatic keyboard considers touch capability, with a remembered override. Dictate requests microphone access only after a tap and only supports on-device recognition; it does not fall back to cloud speech. Voice-pack download requires its own action. Actual Windows microphone support still needs platform acceptance.
- **Tasks/Focus:** today's priorities and planned work dates do not alter deadlines. Overdue work stays visible. Focus works offline, synchronizes between windows, and retains a dismissible completion receipt. Storage failures are labeled as temporary sessions.
- **Search:** local captures, commands, calendar, current media and the three Drive files already visible on home. Unicode and accent folding are supported; there is no background file crawl.

## Connections

- **Spotify:** configure the public Client ID from your Spotify developer app and allow `http://127.0.0.1:8765/api/spotify/callback`. Sign in through Spotify. Premium, developer access/allowlisting, scopes and an existing player are required. Home has play/pause, previous/next, seek, volume/mute, shuffle, repeat and save/unsave where supported. The shelf shows ten recently heard songs or recent albums/playlists; explicit actions start playback. Midnight does not stream audio or automatically transfer/start playback. The larger Now playing panel remains available. Tokens stay in local server data.
- **Drive/New:** optional local Google OAuth setup enables read-only recent-file metadata. Reconnect can reuse saved setup. New opens Docs, Slides and Canva with visible labels. Drive documents are not crawled or uploaded.
- **Calendar:** enter a public HTTPS iCalendar subscription URL or import an `.ics` snapshot. Access is read-only. Saved private subscription addresses stay on the server; settings show only the provider hostname and a blank replacement field. Leave it blank to keep the subscription, paste a new URL to replace it, or use Remove calendar data. Restore previous calendar recovers the prior snapshot/subscription. Explicit Refresh bypasses the subscription cache with a short request limit. Dense recurrence and large results have bounded processing/visible limits.
- **Weather:** explicitly choose a city, coordinates or Use my location. Coordinates go to Open-Meteo for weather, and town lookup uses local GeoNames data. Missing readings are unknown. Observation and fetch times are separate. The clock and Focus end-time display use the weather timezone; remote timezone context is visible, with a 12/24-hour preference.
- **Warmer:** there is no default device IP. Enter the plug's private LAN address, enable local access and Save. Enabling reads state; only an explicit action sends a power command. Commands are never automatically retried. Unknown state is shown as unknown. Some firmware needs `KASA_USERNAME` and `KASA_PASSWORD` in the server environment. Actual device acceptance is separate from fake-device tests.
- **Read:** optional public HTTPS RSS/Atom feeds. Articles use a safe text reader with feed-text fallback; no publisher scripts execute.

## Files, syllabus import and Sounds

**Files** opens local image/PDF/document conversion and a reviewed syllabus-to-Tasks importer. The converter offers 20 routes, including HEIC, PNG, JPEG, WebP, TIFF, PDF, Word, ODT, RTF and text. Supported dependencies are shown beside the choice; Word/Office-to-PDF needs a local LibreOffice installation. Inputs stay on this computer. Workers bound file size, pages, pixels, expanded archives, output size, concurrency and runtime, then remove temporary inputs/outputs. Downloads remain available until cleared or reloaded.

For a syllabus, choose PDF/DOCX/text or paste an assignment list, review detected titles and dates, edit or deselect entries, then **Add selected to Tasks**. This is a local date detector, not an AI interpretation or OCR service. It can miss dates or suggest non-deadlines; absent times are suggested for review. Saving commits the selected batch atomically, retains current captures/drafts and skips matching task text/time.

**Sounds** offers four real field recordings: rain, rain/thunder, a heavy storm, and rain/thunder heard from inside a vehicle with a metal roof. They are approximately 56, 82, 27 and 84 minutes. Selection/volume are remembered; playback starts only after an explicit tap and continues independently of Focus or decorative video. Source/creator/license links stay visible. No synthesized noise or paid service is used.

Large MP3s are optional local assets and are excluded from Git and the source ZIP. Existing installed recordings are preserved by updates. A source checkout can restore the four fixed, checksum-verified public recordings with `python scripts/fetch_ambient.py`. See [ambient-recordings.json](ambient-recordings.json) and [ASSET-CREDITS.md](ASSET-CREDITS.md) for credits and licenses. Sounds are excluded from the service-worker shell cache.

## Background performance

1080p is the default rotating-video quality, with optional 4K. Efficient effects are the default and use **zero backdrop filters**. Optional glass uses an 18px blur cap and opaque home cards without backdrop sampling. Motion pauses while hidden or under Reduced Motion; hidden videos release decoder sources. By default it also pauses when another window is focused, retaining the visible frame. **Pause backgrounds while using another app** saves immediately; turn it off to allow playback whenever visible. This affects decorative scenery, not Spotify audio or Focus.

Included scene paths, posters, dimensions and credits have one source: [static/wallpapers/scenes.json](static/wallpapers/scenes.json), consumed by Python and JavaScript and cached in the offline shell. A still-only clone is a supported state and does not repeatedly request absent MP4s.

## Updates and privacy

Run **Apply Midnight Update.command**, or `python scripts/apply_upgrade.py --target /path/to/installation --restart`. `--check` validates without changes. The installer preflights a persistent per-release environment, checks a reviewed baseline, backs up source, restarts and checks health. Failed startup restores and restarts the prior source. An unreviewed target is rejected. Older installer entry points forward to this path.

Settings shows the release and browser storage origin. An update offers a draft-safe reload. Requests time out; after a server restart the process token refreshes, and the user reviews/retries the action. An uncertain mutation or physical-device command is never replayed automatically.

Private server settings, tokens, imported calendars and downloaded scenery live under `data/`, outside Git/releases. Calendar secrets and connection credentials use local plaintext files with restrictive permissions where supported; protect the OS account/folder. Browser captures and speech stay local/on-device. Never upload `data/`, runtime environments, logs, source backups or personal handoff URLs. The personal ChatGPT destination is a local preference; public source uses the generic home.

## Development and verification

```sh
python -m pytest -q
node --test tests/test_*.cjs
PLAYWRIGHT_MODULE=/path/to/playwright python tests/run-browser.py
python scripts/build.py
```

Browser checks need Chrome and Playwright Firefox. The runner uses an isolated backend and browser profiles, never the installed app's data. Optional complete recording checks use `MIDNIGHT_AUDIO_TESTS=1` after the recordings are installed. Real video-decode checks accept `MIDNIGHT_MOTION_TEST_VIDEO=/path/to/test.mp4`; the additional wallpaper suite accepts `FFMPEG_BIN=/path/to/ffmpeg`. Backend service tests use fake HTTP/devices, and speech tests are simulations.

Dependencies are pinned transitively with hashes in `requirements.lock`. To update, edit top-level pins, run `uv pip compile requirements.txt --generate-hashes --python-version 3.11 --output-file requirements.lock`, verify a fresh hashed install, run the checks, then compare a second clean install's versions. Build output includes all required Spotify/Drive/server modules, the scene catalog, offline shell, dependencies and current tests; it omits credentials, data and runtime environments.

See [CLAUDE-REVIEW.md](CLAUDE-REVIEW.md), [VERIFICATION.md](VERIFICATION.md) and [PLATFORM-ACCEPTANCE.md](PLATFORM-ACCEPTANCE.md) for the current review, evidence and actual-platform gaps.
