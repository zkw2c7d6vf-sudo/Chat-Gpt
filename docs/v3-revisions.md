# Orbit V3 revision record

V2 baseline: `0ee801165df64c8911a5c80e7e06c4d50b4ce92a`. V3 development stays on `orbit-v3`; `main` is preserved. No public deployment or external account changes are authorized by this brief.

## Revision 1 — Audit and specification

Reviewed React/TypeScript/Vite UI, native Node API, Google/Spotify OAuth sessions, ICS parser/feed security, Open-Meteo weather, voice hooks, local task migrations, ZIP updater, and existing tests. Keep working integrations and the compact midnight-navy dashboard. Weaknesses: a large App component, browser-only persistence with no backup UI, no media workflow, and AI suggestions previously entering tasks without an approval queue.

Decisions: local IndexedDB media with a browser-native player; movies/TV/photos and a Player section; no cloud media API or DRM claims. DoorDash's partner Drive API is not access to consumer orders: use a private tracking link plus explicitly manual status/ETA. Build Quick Capture, an editable Daily Command Center (responsibilities, money goals, habits), and a local Approval/Activity Center. Start these empty rather than fabricate college, income, or personal duties. Keep optional OpenAI separate from no-cost local features. Research and limitations: [v3-research.md](v3-research.md).

Implementation priority: library/player → dashboard/navigation and delivery → capture/priorities/approvals → backup/migration → accessibility/responsiveness → failure handling → tested handoff. The following revisions are recorded only after the work and review occur.

## Revision 2 — Local media storage foundation

Added separate IndexedDB metadata and Blob stores. Review favored this over keeping files in React state or uploading them: listing/searching need not load every video into memory, and user files stay local. Enforced file-size/type checks, transaction-based adds/deletes, quota errors, and explicit original-file retention guidance. Browser playback and reload behavior are reserved for the integrated tests in later passes; this inspection alone is not a playback claim.
