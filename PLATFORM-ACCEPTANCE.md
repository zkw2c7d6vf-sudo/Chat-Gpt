# Actual platform acceptance — reliability release

No real Windows, microphone, multi-monitor placement, or physical plug test was performed during this implementation. Browser touch, speech and account failure tests are simulations. Fake backend devices prevent power commands during tests.

Record date, machine, OS, browser/version, input devices and result for each actual test. Do not mark a simulation as a pass here.

| Actual check | Result |
| --- | --- |
| Windows normal launcher, stop/start and persistent runtime | Pending actual Windows machine |
| Windows microphone recognition and local-only speech support | Pending actual Windows machine |
| Explicit speech-pack download; microphone permission denial/recovery | Pending actual Windows machine |
| Hybrid touchscreen with mouse connected/disconnected; automatic keyboard and override | Pending actual hybrid machine |
| Physical touch targets and reading distance on the user's monitor | Pending actual monitor |
| Fullscreen exit/entry and normal/high browser zoom | Pending actual Windows machine |
| External/negative-coordinate monitor placement and denied screen permission | Pending actual multi-monitor setup |
| Sleep/wake, paused/running timer, offline capture and eventual reconnect | Pending actual Windows machine |
| Backup migration from the existing address/profile to the intended Windows origin | Pending actual Windows profile |
| Authenticated Spotify playback/recents and Google Drive reconnect | Pending actual signed-in acceptance |
| Physical plug on/off and unknown-state verification | Separate explicitly authorized device task required |

Implementation/browser evidence is recorded in AUDIT-IMPLEMENTATION.md. No device state may be inferred from a mocked test.
