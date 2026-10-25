# Orbit V3 revision record

V2 baseline: `0ee801165df64c8911a5c80e7e06c4d50b4ce92a`. V3 development stays on `orbit-v3`; `main` is preserved. No public deployment or external account changes are authorized by this brief.

## Revision 1 — Audit and specification

Reviewed React/TypeScript/Vite UI, native Node API, Google/Spotify OAuth sessions, ICS parser/feed security, Open-Meteo weather, voice hooks, local task migrations, ZIP updater, and existing tests. Keep working integrations and the compact midnight-navy dashboard. Weaknesses: a large App component, browser-only persistence with no backup UI, no media workflow, and AI suggestions previously entering tasks without an approval queue.

Decisions: local IndexedDB media with a browser-native player; movies/TV/photos and a Player section; no cloud media API or DRM claims. DoorDash's partner Drive API is not access to consumer orders: use a private tracking link plus explicitly manual status/ETA. Build Quick Capture, an editable Daily Command Center (responsibilities, money goals, habits), and a local Approval/Activity Center. Start these empty rather than fabricate college, income, or personal duties. Keep optional OpenAI separate from no-cost local features. Research and limitations: [v3-research.md](v3-research.md).

Implementation priority: library/player → dashboard/navigation and delivery → capture/priorities/approvals → backup/migration → accessibility/responsiveness → failure handling → tested handoff. The following revisions are recorded only after the work and review occur.

## Revision 2 — Local media storage foundation

Added separate IndexedDB metadata and Blob stores. Review favored this over keeping files in React state or uploading them: listing/searching need not load every video into memory, and user files stay local. Enforced file-size/type checks, transaction-based adds/deletes, quota errors, and explicit original-file retention guidance. Browser playback and reload behavior are reserved for the integrated tests in later passes; this inspection alone is not a playback claim.

## Revision 3 — Integrated personal operating system

Connected the dedicated Media Center sidebar, local player/library, continue-watching and tonight queue, manual DoorDash card, Quick Capture and the Daily Command Center. Added user-entered college/teaching responsibilities, financial targets, and daily habits; no institution, balances or obligations are fabricated. Changed model task suggestions from automatic insertion to an explicit Approval & Activity queue. Added safe local backup/preview/restore. Review retained V2’s calendar/weather/Spotify code and introduced no paid dependency. TypeScript/build and local service tests are checked before the next refinement pass.

## Revision 4 — Review actual control over daily work

Review found that pinning only the three visible priorities would prevent selecting another task. Added a full priority chooser, kept due responsibilities ahead of unpinned tasks, and made habit-day state refresh each minute. Added a captured-item management path so goals/habits/notes do not become permanent clutter. V3 appends its two concrete build follow-ups once, preserving V2 completion/deletion choices. No academic duties or financial values are prepopulated. AI proposals remain pending until approved; backup includes these local records but excludes credentials and delivery links.

## Revision 5 — Media organization and accessible controls

The first library pass grouped files by kind but did not give Player its own destination or organize episodes/photos beyond filenames. Added an explicit Player section, TV series/season/episode fields and series filtering, and photo album metadata/filtering. Retained original filenames, deletion confirmation, keyboard dialog controls, capability-gated fullscreen/PiP, local subtitle loading and URL cleanup. No external poster database is assumed; user metadata and local photo previews are used. Actual decode/resume tests are running rather than treating a visible video tag as success.
