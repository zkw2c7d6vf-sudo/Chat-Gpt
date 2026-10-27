# Orbit development changelog

## 2026-10-27 — 4.6 existing-workflow completion

- Reproduced the 4.5.2 Shopping quota-write crash in isolation; added guarded persistence, visible retry, retained in-memory changes and search/offer recovery tests. Incorporated PR #5's safety intent without merging its unverified branch.
- Completed task search/sort/export, overdue Planner recovery, Education course/duplicate/export, Inbox search/unread/email-to-task, Drive filters/sort and manual finance edit/date/filter/undo workflows.
- Refined Media filters/sort, Focus history, Notes/life-organizer export, File Studio copying/input recovery, Spotify command handling, assistant transcript export and backup inventory.
- Added widget search and reversible hide-all, consistent search borders and on-demand module loading while retaining the sparse Home, storage contracts and gesture performance path.
- Added module/storage regressions and CSV safety checks; documented category-level evidence and private account/Mac acceptance limits. Preserved newer baseline handoff commits and permanent user operating rules.

## 2026-10-27 — 4.5.2 Home performance and controls

- Removed per-pointer React/layout persistence and mounted-panel reordering from desktop dragging; added frame-scheduled transforms and one drop save.
- Reused panel contents during gestures, paused expensive overlapping blur, and handled cancellation and lost capture.
- Reduced the permanent dock to daily Home tools plus Backgrounds; retained optional window restoration and Widgets access.
- Added a bordered, labeled search control on desktop/tablet/mobile and tighter mobile panel spacing.
- Added regression coverage with a large local scene and running Focus; refreshed previews.

## 2026-10-27 — 4.5.1 scene-first Home rebuild

- Rebuilt the Home composition from the supplied earlier reference with a full-screen navy scene, large greeting, slim icon rail and compact dock.
- Replaced eleven initially open windows with purposeful context defaults and on-demand tools.
- Preserved old window layout storage and added the new layout to backups.
- Added desktop/mobile screenshots and scene-specific acceptance coverage while retaining all-widget and module regressions.

## 2026-10-27 — Orbit 4.5

- Completed meaningful expanded content for every Home widget and the shared typed renderer.
- Fixed saved geometry bounds, z-order, window stacking, mobile content, weather clipping and background dialog keyboard focus.
- Added Education Center, a combined weekly Planner, task editing/filtering/undo, persistent Focus/history/shared ambient volume and local File Studio.
- Added live eBay snapshot comparisons, budget/sort, missing-shipping distinction, bounded catalog cache and local streaming-service marks.
- Expanded validated backups without including credentials, private image bytes or local media files.
- Verified production build, 73 unit/API tests and 72 browser checks; live public weather/catalog requests succeeded. Private Mac/account checks remain user acceptance work.
- Kept the classic Home fallback and all historical release branches; no public deployment or main overwrite.

## 2026-10-27 — Immersive Home feature branch (draft)

- Introduced a LifeAt-inspired, but Orbit-branded, scene-backed window workspace while retaining the original sidebar logo and dynamic time-based greeting.
- Added movable/resizable/minimizable/reopenable widget surfaces and Today / Study / Focus / Unwind layout persistence.
- Added search and categories for backgrounds (36 local presets plus external Wikimedia photo search); local image choice supported.
- Embedded eleven panels, including newly requested Email and Continue Watching, with existing Orbit data sources rather than new duplicate records.
- Added a Home five-day weather selector while preserving the legacy seven-day weather behavior in classic Home.
- Added backup support for window state and a LAN-safe record-ID helper.
- Added GitHub Actions build/unit/browser validation and test coverage; a confirmed green run was achieved at commit `918deaf1` on 2026-10-27.
- Added a full Codex conversation catch-up, universal dynamic expansion specification, release status and next-task handoff.

**Pending:** Build richer expanded content for every Home widget, full acceptance suite, real account/device smoke tests and deployment. These are **not** completed features. GitHub PR #4 remains draft.
