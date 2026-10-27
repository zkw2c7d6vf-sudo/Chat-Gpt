# Codex Implementation Contract — Orbit Home Dynamic Widgets

**Status:** Approved product behavior / implementation handoff, **not** a claim that every expansion is implemented or tested.
**Base:** `orbit-v4.4` plus the open `feat/orbit-immersive-home-2026-10-26` branch and PR #4.
**Primary sources:** `src/ImmersiveHome.tsx`, `src/App.tsx`, `src/WeatherPanel.tsx`, `src/media/MediaCenter.tsx`, `src/media/store.ts`, `src/backup.ts`, and `tests/immersive-home.e2e.mjs`.

## Direct user requirements (behavioral source of truth)

- Use the existing Orbit logo, a time-dependent Good morning/afternoon/evening greeting, and Orbit's Midnight Navy visual system.
- Remove fluff/flavor text. Use practical labels: Spotify (not Soundtrack), Email, Continue Watching, Calendar, Today's Priorities, Weather, Focus Session.
- Replace the three-scene strip with a searchable background browser, categories, many results, and user-selected pictures. Background selection is a Home toolbar action, not a persistent bottom strip.
- **No Edit Layout button.** Directly interact with widgets as desktop windows. Clicking brings one forward; dragging the title bar moves it; native-feeling minimize, close, reopen, maximize/restore, resize and persistence work for *every* widget.
- **Expanded windows must provide additional useful information and controls in every widget, not just larger copies of compact cards.** Expand is a first-class content state, for all current and future Home widgets.
- Weather is its own movable widget. Compact: five-day forecast. Expanded: seven-day forecast and more available detail. Do not also put the temperature in the Home top bar.
- Add functional Email and Continue Watching widgets using the existing Gmail and Media Center data; show honest disconnected/empty states.
- Preserve original tasks, calendar, Spotify, weather, notes, mail, media, finance, files, connection settings, existing localStorage keys, secrets, and backup compatibility.

## Architectural contract

1. One authoritative widget registry with a stable id, semantic title, icon, compact dimensions, minimum usable sizes, supported expanded behavior, source modules, accessibility name, and optional feature-availability predicate. **All widgets** (including new ones) must pass through one universal window manager.
2. Suggested typed contract (adapt to source): `HomeWidgetDefinition = { id; title; icon; defaultSize; minSize; render(context: { mode: "compact" | "expanded"; availableWidth: number; availableHeight: number; workspace: string; openFullModule(): void }): ReactNode; }`. The current source already accepts `content: ReactNode | ((expanded: boolean) => ReactNode)` as a backward-compatible first step. Codex should evolve that into the common context without breaking existing data flows.
3. Window transitions are **view-state changes**, not data mutations: compact ⇄ expanded ⇄ compact, open ⇄ minimized ⇄ restored, open ⇄ closed ⇄ reopened. Only one content/data source exists; the widget can expose progressively more of it.
4. Distinguish **manual resize** from **maximize**. Resizing may reveal more information progressively at agreed thresholds; maximize always shows expanded content. Restoring returns the exact prior geometry. Minimized/closed widgets should not keep expensive background work active unnecessarily.
5. Every widget shows valid loading, empty, disconnected, error, and data states. Do not substitute sample information unless demo mode is explicitly enabled and visibly labeled.
6. Keep source modules as the authority: App task state, selectedDate/calendar provider, Gmail dashboard/read state, Spotify playback, WeatherPanel/Open-Meteo, local notes, media IndexedDB/progress, existing files and ambient focus sound state. No second task, email, media, weather, or calendar database.
7. Never send user-selected background images or student/personal content to a third-party service. Remote scene search is optional, transparent, and must fall back to local scenes. Do not bundle unlicensed third-party images as assets.
8. Scene and per-workspace window state can live under `orbit-immersive-home-v1`. Validate restored geometry and identifiers, clamp offscreen windows; preserve backups. Uploaded image bytes are excluded from portable backup or handled by an explicitly approved image-export flow.
9. Desktop behavior: title-bar drag, click to raise, bottom-right resize, maximize/restore, minimize to dock, close to Widgets list, workspace-specific persisted geometry and visibility. Keyboard: accessible focus, button names, arrow movement, Shift+arrow resize or ordered controls, escape for modal. Mobile behavior: stacked responsive windows, no inaccessible offscreen absolute positions, visible open/close/expand controls, accessible reordering.
10. Maintain **classic-home rollback** with `?classic-home=1` until all acceptance checks pass. Existing provider flows, route ids, auth callbacks, and local data remain unchanged.

## Expanded content contract for *each* widget

| Widget / existing source | Compact | Expanded — visibly different, real behavior |
|---|---|---|
| Up Next — `App.tsx` calendar state | First upcoming event/time or honest empty/error | Chronological list of up to the next 7 days of events, clear date and time, open-event action, Planner link. No invented events. |
| Today's Priorities — `App.tsx` tasks | Top 3 unfinished, sorted high/normal/low and due date | All unfinished tasks (plus optional completed toggle), group or filter by due date/priority, inline mark complete, add task, jump to Planner. Same task identities and save logic. |
| Focus Session — `App.tsx` focus timer | Countdown, start/pause, duration | Timer plus available durations, reset, focus sound options and session status. Future statistics/history only after a real persisted session log is introduced and tested. |
| Spotify — existing playback/dashboard | Connection/track/artist/play/pause | Album, current device, playback progress, available skip/control actions, Spotify link and reconnection state. No fictitious track or device; respect provider permissions. |
| Weather — `WeatherPanel.tsx` | Current weather plus 5 days | 7 days, location/unit selection, high/low and precipitation details from actual Open-Meteo fields, refresh/retry and attribution. Honor saved location and units. |
| Email — existing `inboxPanel` | Recent 3, unread/important count | Scrollable up-to-30 list, important/all filter, sender, subject, snippet, open/read action, Inbox link, accurate disconnected/error state. Read-only; no send/delete implied. |
| Continue Watching — `MediaSummary` and media store | One most recent resumable item | Several legitimate in-progress/queued items with progress, titles and resume actions, plus open Media Center. Distinguish watched, queued, missing file and unavailable browser store. Never invent provider streaming availability. |
| Quick Notes — `orbit-notes` | Short editable text | Larger editor with remaining space/character count or simple editing tools, same underlying local notes. Closing or minimizing must never discard unsaved typed text. |
| Calendar — `calendarPanel` | Selected week (7 dates), up to 4 agenda items | At least two weeks of selectable dates, extended multi-day event listing and date navigation, jump to Planner. Preserve all-day and calendar source/error distinctions. |
| Ambient Sound — soundscape/focus state | Select ambient preset; show on/off state | All supported presets and the existing Focus session interaction; separate controls or mixer channels only if backed by actual audio nodes. State must persist; no fake volume sliders. |
| Recent Files — `filesPanel` | Recent 4 accessible files | Up to 30 files in scrollable view, file type and modified metadata, open and Files module. Show Drive disconnected/failed status accurately. |

**Rule for all new widgets:** Every widget definition must include a written compact/expanded delta, loading/empty/error behaviors, data source, accessibility story, and automated expand/restore test. Widgets that cannot show a meaningful expanded mode should link to their full module **and** display contextual detail rather than merely stretching blank space.

## Interaction and rendering principles

- Expand button should provide an accessible label `Maximize [widget]` and become `Restore [widget]`; title-bar double-click may mirror maximize but must never interfere with dragging. Preserve prior x/y/width/height when restoring.
- Expanded content may scroll independently. Avoid nested overflow fighting; components with long lists should have responsive heights and sticky controls if useful. Expanded widgets must not cover modal dialogs or settings.
- On desktop, user resizing beyond a content breakpoint can show medium-detail content; do not couple additional API fetches to each drag event. The expand action always shows the full expanded view even when viewport width varies.
- Do not eagerly mount independent copies of the same weather, email, calendar or media component. Use a shared selector/store and render one appropriate view.
- The layout manager handles window state. Each widget owns only its domain's UI controls and derived data, not geometry.
- Favor existing Lucide icons from this repository; labels must remain visible or accessible and not depend on ambiguous glyph-only controls.
- No motivational decorative copy, filler headings, fake "now playing" records, duplicate nested widget titles, or redundant status badges.

## Coding sequence for Codex (bounded, auditable)

**Phase 0 — safety / baseline.** Inspect the latest Mac checkout, `git status`, actual branches/commits, and existing backup. Do not reset/clean/force-push or overwrite uncommitted local changes. Do not auto-merge this PR; compare it with newer local work. Run `npm ci`, `npm run build`, `npm test`, `npm run test:home` and original browser regression suites. Log failures before editing.

**Phase 1 — universal contract.** Implement typed `HomeWidgetDefinition` and consistent `render({mode,availableWidth,availableHeight,...})`; refactor the window manager so every widget can switch between compact and expanded, preserving its geometry and workspace-specific state. Add code-level validation requiring each widget definition to provide both variants or a documented equivalent.

**Phase 2 — feature adapters.** Implement the eleven rows above, reusing existing component logic. Complete obvious low-risk adapters first (Email, Files, Weather, Notes), then Calendar, Tasks, Up Next, Focus, Spotify, Media, Ambient. Make targeted, minimal changes to the existing child components. Do not add mock data to fill missing fields.

**Phase 3 — test matrix.** For every one of the 11 widgets, test compact content, maximize → additional information, restore → prior content/geometry, minimize → dock → reopen, close → Widgets → reopen, refresh persistence, keyboard interaction, and a narrow viewport. Test populated, empty, disconnected, error, and demo-mode states as applicable. Test that expanded data comes from the real underlying store and mutations reflect in its full module. Specifically assert 3→all for Tasks, 7→14+ dates for Calendar, 5→7 forecast dates for Weather, 3→up-to-30 email rows, and 1→multiple resumable media items where data exists.

**Phase 4 — release.** Fix all build, unit and browser regressions. Exercise HTTP LAN origins; preserve UUID fix. Verify scene-search fallback, private background handling, exported/restored layout and data integrity, and no credential leaks. Check actual Spotify/Google integrations in the user's environment. Document remaining provider limitations and only then mark CI green, request final review, and merge into the approved release branch.

## Definition of done (not negotiable)

- No default Home widget only gets physically larger when maximized; each reveals actionable relevant detail or a functional richer control set.
- No data loss, duplicate records, spurious third-party calls, fake provider data, disappearing widgets on responsive resize, or lost pre-maximize geometry.
- Clear regression evidence (build, unit, e2e) and before/after screenshots for desktop and mobile; human check of the actual live account integrations.
- User can revert to classic Home without losing the redesigned workspace settings.
- A change log states precisely which widgets have real expanded implementation, which require provider setup, and which remain planned. No claim of complete release until the acceptance matrix passes.
