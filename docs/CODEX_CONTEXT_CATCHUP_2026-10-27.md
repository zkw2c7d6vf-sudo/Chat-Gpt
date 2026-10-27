# ORBIT — Codex catch-up and source-of-truth handoff

**Prepared:** 2026-10-27. **Purpose:** Preserve everything materially decided in ChatGPT about Orbit since the earlier Codex context ran out, including the LifeAt-inspired Home redesign, follow-up changes, planned dynamic expansion across all widgets, GitHub integration work, and release gates.

**Read in order before coding:**
1. This catch-up file (product decisions, statuses, priorities).
2. `docs/CODEX_HOME_DYNAMIC_WIDGETS.md` (authoritative all-widget compact/expanded contract).
3. `docs/ORBIT_IMMERSIVE_HOME_INTEGRATION.md` (branch setup, tests, background privacy, rollout).
4. Actual current `src/App.tsx`, `src/ImmersiveHome.tsx`, `src/immersive-home.css`, `src/WeatherPanel.tsx`, `src/media/MediaCenter.tsx`, `src/backup.ts`, `tests/immersive-home.e2e.mjs`, Git status and run logs.

## 0. Reliability / important warning

This document is a record and development directive, not proof of current deployment. The **latest actual Mac checkout is unknown** and may differ from both GitHub and uploaded older ZIPs. Never reset/clean/force-push/overwrite unknown changes. GitHub's `main` remains an older v2 lineage, not the current development target. The remote feature branch is **not deployed to the user's Mac**, PR #4 is a **draft**, and only validation evidence (not promises) can establish readiness. Do not claim full release or that provider integrations are proven without passing tests and real-user verification.

## 1. Context Codex may have missed

- Orbit is a personal digital headquarters / local-first web application, not Clear Page Web. Keep the products separate. Midnight Navy visual identity and original Orbit logo must remain. User favors coherent visual hierarchy, concise functional UI labels, clear Lucide-style icons, and zero unnecessary 'flavor text'.
- Earlier architecture: React 19, TypeScript ~5.8, Vite 6, Node server, Playwright; Orbit v2 integrated Spotify, direct calendar and weather. v3 and v3.1 planned a more cohesive Home/Planner/Library/Shopping/Orbit AI architecture, but previous designs are NOT proof of implementation. v4.3 added practical features; v4.4 is the actual GitHub base for this Home PR.
- Protect tasks, email, calendar, Spotify, Open-Meteo weather, Focus, local notes, finance entries, Media Center/local media progress, Shopping Scout, Files, backup, OAuth credentials/configuration, and existing browser origin/storage. Preserve working modules even if Home becomes simpler.
- User wants at least the broader LifeAt-style feature inspiration: immersive scene-based workspace, floating panels, task/focus/music proximity, ambient soundscapes, saved contexts/layouts. This is **inspiration** only, not a pixel-perfect clone, and should not copy proprietary visual assets or imply unsupported providers.
- Context from prior Orbit work: prefer staged releases with regression tests; '$0 in additional mandatory recurring infrastructure/API charges'; provider access and pricing must be honest; maintain user privacy; no student information in external AI requests; no fake live records; no unapproved destructive or cloud operations.
- Existing user direction predates this redesign: Home = 'what you need to know'; modules = 'what you need to do'. Remove the Approval/Activity box from Home, avoid redundant 'private' badges on Tasks, fix crowded high/low weather labels, remove Focus Timer redundant category text, fix Shopping Scout 'Add something you want to find' crash (HTTP-LAN `crypto.randomUUID()` source was identified).

## 2. Redesign decision timeline, verbatim excerpts and approved interpretation

**Initial request:** 'I want you to help redisgn the main screen as well as refine other features while taking major inspiration from https://lifeat.io/ for its features and espesically its main home screen'.

**First concept:** Immersive scenery + Home widgets, Today/Study/Focus/Unwind modes, floating controls, original Orbit integrations preserved. This was a standalone visual prototype; sample entries were illustrative.

**Revision 2 user feedback:**
> 'The big text that says, "A calmer way in today." We're gonna revert that back to what we had before, which was the dynamic text based off the day that says, "Good morning, good afternoon."'
> 'I want to be able to move around the focus session bars and today's priority. Just everything customizable widgets, so be able to move them around.'
> 'I also want to be able to change the background in some way. I also want to keep the Orbit logo we normally use.'
> 'Also just don't put your soundtrack, put just as a Spotify integration. Don't put that flavor text. I don't like flavor text in general, just so you know.'
> 'Refining the icons we're using as well and see if you can adjust the order based off of importance of the features and make the icons clear on what they are.'
> 'Also make weather its own widget. Don't put it in the top bar. I like it as a widget with like a five-day forecast.'

**Revision 3 user feedback:**
> 'I want to be able to move the widgets without an edit layout button.'
> 'I want them to be adjustable within the widgets. So I want to be able to, like, press on the widgets, click into it, and then move it from there automatically.'
> 'I also want to be able to minimize the widgets and do all that from clicking on them, kind of like you would on a normal browser where you can open and close tabs.'
> 'Also try to include a couple other widgets in the sample just for testing.'

**Scene-library and code integration request:**
> 'remove where it says at the bottom with the different backgrounds. I want you to model kind of how Life At has it, where it's a searchable background thing. So it's a ton of them, not just, like, three options.'
> 'I want you to actual update. I want you to actually update Orbit with this new front-facing UI, upload the changes to GitHub, and code it all for me.'

**Additional widgets:**
> 'I want you to implement a continue watching widget and an email widget.'

**Release ambition:**
> 'Want a complete and finalized build ready for me to start using by the next time we talk.'
Interpret as the user's desired **release outcome**, not a license to bypass testing. Work must happen in the active Codex session; do not falsely promise asynchronous completion or a later delivery.

**Dynamic expansion, latest requests:**
> 'also work on dynamic expanding of widgets so that they show more info. For example, making the priorities widget should show more priorities, calendar should show more days'
> 'focus on the framework we give to codex, also make sure we are adding that functionality for all widgets not just the ones specified'
> 'also note everything we have talked about thus far since the last time I ran out of storage for codex so that it has proper context of everything it missed'

**Approved behavior:** Every widget must provide a meaningful expanded state (more real content and/or controls), rather than just physically resizing. All widgets share the same movable, resizable, minimize/dock, reopen and max/restore contract. Responsive mobile arrangement remains usable and accessible. No separate Edit Layout button. Original Orbit time-based greeting, logo and app/navigation preserved; icons clear and ordered by importance; minimal labels only.

## 3. Home widget inventory and expansion scope

**11 initial native widgets; no fake provider content:**

| Window | Compact view | Expanded view required | Source of truth |
| --- | --- | --- | --- |
| Up next | Next real calendar event (or accurate disconnected/empty) | Multi-day upcoming schedule, events/times, open event and Planner action | `App.tsx` calendar state |
| Today's priorities | 3 open, prioritized tasks | All unfinished tasks, due dates/priority, filter/group and complete/add actions | Existing `orbit-tasks` |
| Focus session | Timer, duration and start/pause | Richer durations, reset, sound settings and truthful session controls; do not invent statistics | Current Focus timer/sound state |
| Spotify | Connection + live track/playback | Additional real metadata, playback/device/progress/controls, Spotify link | Existing Spotify state/endpoints |
| Weather | Current conditions + five-day forecast | Seven-day forecast, precipitation, location/unit options and retry | Existing Open-Meteo WeatherPanel |
| Email | 3 recent/important messages | More messages, important/all filter, sender/subject/preview/open read-only action, account state | Existing Gmail dashboard/mail state |
| Continue watching | Most relevant resumable/queued item | Multiple actual in-progress/queued items and resume progress/actions | Existing `MediaSummary` and local media store |
| Quick notes | Immediate short editor | Larger editor and useful editing detail, never another notes store | Existing `orbit-notes` |
| Calendar | Seven-day strip and selected-day overview | At least two weeks of dates and richer multi-day agenda navigation | Existing calendar/events |
| Ambient sound | Selection/current mode | All supported sounds, Focus relation and only real audio controls | Existing Focus sound engine |
| Recent files | 4 recent files | Up to 30 real files, metadata and open/full-module actions | Existing Google Drive dashboard |

**Every future widget** must explicitly specify compact, expanded, loading, empty, error/disconnected, source, privacy and acceptance tests. For exact behavioral acceptance matrix read `docs/CODEX_HOME_DYNAMIC_WIDGETS.md`.

## 4. What has ALREADY been coded and uploaded

- **Repo:** `zkw2c7d6vf-sudo/Chat-Gpt`.
- **Base branch:** `orbit-v4.4` (older inspected SHA `5b8adae199acc2544c35170caf7e2d6b311c2274`). `main` remains old v2; do not target it until the new app is approved.
- **Feature branch:** `feat/orbit-immersive-home-2026-10-26`.
- **Draft PR:** https://github.com/zkw2c7d6vf-sudo/Chat-Gpt/pull/4 ; GitHub reported this branch mergeable, but mergeability is not test readiness.
- **New source:** `src/ImmersiveHome.tsx` implements the window workspace, Today/Study/Focus/Unwind layouts, click-to-front, drag title bar, mouse/keyboard resize, maximize/restore, minimize-to-dock, close/reopen, widget management, browser storage of geometry, background picker. The type now permits `content: ReactNode | ((expanded: boolean) => ReactNode)`, a *framework bridge* for dynamic expanded content.
- **Style:** `src/immersive-home.css` and import through `src/main.tsx`. Original Orbit logo remains in `src/App.tsx` navigation.
- **App integration:** `src/App.tsx` replaces the default Overview content with 11 real-source widget definitions. `?classic-home=1` returns the old Overview as a temporary safe fallback. Currently most App widget descriptors still pass static JSX; their compact/expanded visual/data variants are NOT all implemented. This is the main next-step gap.
- **Weather:** `forecastDays` optional prop added to WeatherPanel, default seven; Home uses five. Original seven-day accessibility label repaired for older tests.
- **Scenes:** 36 generated gradient presets (local/offline), remote Wikimedia Commons searchable photo library with pagination, optional user PNG/JPEG/WebP local image upload. Online results depend on Wikimedia availability, image terms and licensing. They are not proof of unlimited verified licensed bundled scene assets. Background control is in Home toolbar, not bottom strip.
- **Backup:** `src/backup.ts` includes `orbit-immersive-home-v1` layout state in approved backup/restore; rejects unsupported scene URLs and excludes private uploaded image bytes (restored as a safe built-in background). Other user data keys are preserved.
- **LAN ID fix:** New `src/id.ts`; App, CommandCenter, ShoppingScout, FinancePanel and media store use a UUID helper instead of `crypto.randomUUID()` so HTTP LAN origins do not crash on that call.
- **Tests:** `tests/immersive-home.e2e.mjs` and `tests/home-backup-unit.test.mjs`. Original V2/V3/V3.1/V4 browser suites use classic Home fallback where they still assert the old Overview layout.
- **CI:** `.github/workflows/orbit-validation.yml` runs clean Node 24.22.1 `npm ci`, `npm run build`, unit tests, installs Playwright Chromium, starts Orbit, runs new Home tests and all four historical browser suites.
- **Docs:** `docs/ORBIT_IMMERSIVE_HOME_INTEGRATION.md` and `docs/CODEX_HOME_DYNAMIC_WIDGETS.md`. This file makes the handoff complete.

## 5. Validation status and risks (read latest CI live, do not assume green)

- Real GitHub Actions npm dependency install succeeded; an initial TypeScript unused `index` parameter error was fixed.
- The browser suite caught minimize/drop interaction where window-raising could interfere with minimize. Source handler updated not to raise on button/interactable clicks.
- Another test caught selected Aurora scene reverting after immediate reload. Scene/layout saving reverted to immediate synchronous localStorage effect (retest required).
- More recent CI successfully reached browser E2E. The old V2 regression then failed because changing WeatherPanel's seven-day accessibility label to `7-day forecast` broke a test expecting `Seven-day forecast`; fixed in commit `d170bac...`, but must be validated by latest runs.
- Last inspected CI had runs for updated commits still active; do not claim every check passes until latest SHA is fully green. A successful `npm run build` and `npm test` alone is insufficient.
- Only the remote GitHub source is changed. No verified deployment to the user's Mac, private OAuth services, Jellyfin home PC, or personal network. The user's local working directory, tokens, current provider connection state and origin-scoped localStorage are unknown.
- Existing `MediaSummary` currently derives a single progress/queued item; expansion to multiple real items will need an appropriate public selector or safe new component API over the existing media store, never duplicate data.
- UI labels and widgets nested in other cards can become redundant when embedded. Codex should simplify functional copy and avoid display collisions.
- The dynamic expansion framework type exists, but content rendering changes for all 11 widgets and their deep acceptance tests are **specification work still outstanding** at this handoff.

## 6. Codex's next concrete assignment

1. Read this file, then `docs/CODEX_HOME_DYNAMIC_WIDGETS.md` and `docs/ORBIT_IMMERSIVE_HOME_INTEGRATION.md` in full. Review PR #4 and most recent CI failures.
2. Inspect the ACTUAL Mac checkout and any uncommitted files before changing or switching branches. Verify a current, restorable backup. Do not discard, overwrite, or auto-merge local changes.
3. Run/re-run build, unit and browser gates on current feature-branch SHA. Repair failures in-place with focused, tested commits. Preserve the `?classic-home=1` rollback.
4. Turn the current widget renderer's function-content bridge into an explicit shared contract (mode, available size, appropriate supported control sets) used by every widget. Implement **meaningful expanded content for all eleven**, with no duplicate stores and actual provider information.
5. Prioritize meaningful content and data correctness: Tasks 3→all, Calendar 7→14+ dates and multi-day agenda, Weather 5→7, Email 3→more, Media one→several, Files 4→more, other widgets reveal useful controls/status. Preserve prior window geometry and per-workspace state across expand/restore and reload.
6. Add a data-backed E2E matrix per widget: compact, expanded, restored, minimized/docked, closed/reopened, reload, mobile, keyboard, empty/error/disconnected, and no false live data. Test backup roundtrip, LAN non-secure origin and new scenes with online fallback.
7. Check performance and long-list overflow, pointer capture, resize bounds, scene privacy, accessibility, color contrast, modal focus, no flavor text, icon ordering. Verify original logo/greeting/nav and existing providers haven't regressed.
8. Deliver only after a clean CI build/complete suite plus real-user provider/device smoke checks. Update `ORBIT_STATUS.md`, changelog and next-task file to reflect **what actually passed**, and request review of PR #4 into `orbit-v4.4`. Never silently merge to `main`.

## 7. Related broader roadmap (NOT scope of this Home release)

- Education HQ native integration with existing Planner records and student-data privacy.
- File Studio browser-local conversions (separate candidate work; avoid accidental overwrite).
- Unified Media Center with eventual Jellyfin home-PC connection and legitimate community rating sources; existing local Continue Watching must work first.
- Shopping Scout genuine retailer adapters, price comparison and eventually order/delivery integration; no invented prices or beta API access.
- Orbit AI optional provider-independent/local AI experiments; no unapproved paid API requirement; keep Orbit Future Lab speculative concepts separate.

**Handoff rule:** Never treat a prior assistant's statement 'tested', 'ready', 'will be done later', or 'integrated' as evidence. Inspect the actual source, complete the tests and report the verified SHA and environment. The user wants a polished, complete app, not a mockup or superficial expansion.
