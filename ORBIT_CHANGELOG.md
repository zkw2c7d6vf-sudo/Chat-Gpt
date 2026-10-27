# Orbit development changelog

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
