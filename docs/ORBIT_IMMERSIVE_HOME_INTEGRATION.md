# Orbit Immersive Home — integration status

**Branch:** `feat/orbit-immersive-home-2026-10-26` (based on `orbit-v4.4`)

## Included
- Replaces default **Home** (previously Overview) with a scene-backed workspace. Original Orbit SVG, local-time greeting, app navigation, provider connections, and data records remain in the existing App.
- Eleven movable Home windows: **Up next, Today's priorities, Focus session, Spotify, Weather (five days), Email, Continue watching, Quick notes, Calendar, Ambient sound, Recent files**.
- Drag title bars without an edit mode, click-to-front, minimize/dock/restore, close/reopen, maximize, desktop resize, keyboard arrow movement/resize, and mobile ordering through Widgets.
- Backgrounds are opened from the **Backgrounds** button in Home's toolbar. There is no bottom scene switcher. Includes 36 built-in color scenes, a keyword-searchable Wikimedia Commons photo library with pagination, and custom PNG/JPEG/WebP background selection (limit 1.5 MB).
- Layout, window state, active space, and selected background saved under `orbit-immersive-home-v1`. Widgets reference the existing task, mail, calendar, weather, notes, Spotify, and media services, rather than copying records.
- `src/id.ts` fixes insecure-LAN `crypto.randomUUID()` crashes during capture, tasks, shopping, finance, and media-library operations.
- Dashboard backup can include Home layouts and online/built-in scene choices; personally uploaded background image bytes are **not** exported. Restore uses the Nightfall preset until the user selects the local image again.
- WeatherPanel takes an optional `forecastDays` prop, defaulting to 7 for all preexisting usages.

## Legacy fallback
Add `?classic-home=1` to the application URL to render the previous v4.4 Home. Historical browser suites use this fallback for regression coverage; the new `npm run test:home` suite exercises the redesigned default Home.

## Development and validation
```sh
git switch feat/orbit-immersive-home-2026-10-26
npm ci
npm run build
npm test
npm run dev
# In a second terminal:
npm run test:home
npm run test:e2e
npm run test:v3
npm run test:v31
npm run test:v4
```

**Environment limitation:** dependency installation and executable browser tests were unavailable in the authoring container because its external npm registry could not be reached; these tests and build must be run in the actual Orbit environment before merging. Code was checked by source inspection and TypeScript syntactic parsing, but provider connections were **not** tested.

## Background privacy and licensing
Opening photo search makes a direct request from the browser to Wikimedia Commons. Selected online images are loaded from Wikimedia hosts; they are **not** bundled in Orbit or hosted by its server. Creators may have attribution/share-alike requirements depending on each image. Do not republish them without checking the specific file license. Built-in scenes function offline. User-supplied images are kept locally and are not sent to Wikimedia.

## Release requirements
1. Audit the newest Mac checkout for uncommitted work before applying this branch.
2. Export/restore current local data before testing new storage behavior.
3. Validate window drag/reload, backdrops, mobile, five-day weather, Email disconnected/error state, Continue Watching resume, and Spotify.
4. Test actual HTTP LAN origin and live connected providers separately.
5. Merge to `orbit-v4.4` only after validation. Do not overwrite `main` or a newer local working tree.
