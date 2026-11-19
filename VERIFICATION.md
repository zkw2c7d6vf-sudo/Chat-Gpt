# Current verification — 2026.11.18-r46-review

The release includes the audit reliability work and the newest Spotify deck/shelf, including Liked Songs and the contained listening controls. This review adds private calendar responses, blank warmer setup, one wallpaper catalog, focused-window scenery playback and bounded optional glass, and removes retired source artifacts. The installed Files/Sounds features and their dependencies, font/license, source catalog and tests are merged; large optional audio is retained locally and excluded from source publication.

| Check | Result |
| --- | --- |
| Python backend/unit checks | 141 passed; two known dependency/deprecation warnings |
| JavaScript model checks | 64 passed |
| Current browser runner | 12 core suites passed with isolated profiles/data: Capture, Focus/Drive, Calendar, Notifications, Toolbar, Chrome/Firefox layout, audit regressions, recovery/live update, weather/fonts/keyboard, Spotify shelf, privacy/motion and Files/deadline import |
| Late Spotify component integration | Current shelf/deck suite and Chrome/Firefox desktop matrix rerun successfully |
| Files / Sounds preservation | Real conversion/import suite and muted playback checks passed against all four installed field recordings |
| Real video decode/rapid Next photo | Additional wallpaper suite passed using generated local clips and fake API responses |
| Calendar privacy | Saved bearer URL absent from bootstrap/settings replies; unrelated save retains it; replacement/clear/restore keep the input masked |
| Warmers | Blank disabled setup accepted; enabled blank setup rejected; saved valid device setup retained; fake devices only |
| Wallpaper authority/credits | Python/JS share the cached JSON catalog; attribution follows the frame actually shown, including the included still when motion stops |
| Release startup | Clean extracted ZIP checked with fresh temporary backend data, without source-checkout imports |
| Source publication | Public runtime/test allowlist; data, credentials, logs, runtime environments, MP4s, backups, obsolete checks/reports and retired modules excluded |

## Measured component behavior

Chrome played a generated 320×180, 12 fps video while the document remained visible. Window focus was simulated because headless Chrome does not reliably transfer native focus across its windows. With the visible-window override, 18–22 frames were presented during 1.5 seconds. With focused-only playback and the simulated window unfocused, zero frames were presented: **100% fewer background-video frames in that test interval**. Resume, retained frame/source, remembered override and hidden/reduced-motion release were checked separately.

This does not measure whole-dashboard responsiveness, GPU utilization, battery life, or FPS on the user's display. Efficient mode already used zero backdrop filters before this review. Optional glass now avoids backdrop sampling behind opaque home cards and caps other glass surfaces at 18px; its GPU impact has no measured percentage claim.

Live signed-in Spotify/Drive behavior, actual Windows/hybrid touch/microphone use and physical power changes were not established by these tests. See PLATFORM-ACCEPTANCE.md. All browser/account/device fixtures remain distinct from actual platform acceptance.
