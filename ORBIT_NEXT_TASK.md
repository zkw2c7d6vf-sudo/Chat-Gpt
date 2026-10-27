# Orbit next task — functional completion after 4.5.2 (2026-10-27)

**Start at `CODEX_START_HERE.md`.** Use `orbit-v4.5.2` as release baseline, NOT historical `main`.

Priority 0: Verify and resolve the reported Shopping Scout crash on “Add something you want to find.” Draft PR #5 (`fix/orbit-v452-shopping-storage-safety-20261027`) catches localStorage write exceptions, but its root-cause coverage has not been established. Reproduce and test; don't claim fixed without evidence.

Priority 1: Inventory and functionally exercise every shipped category. Test read/write persistence, navigation, keyboard/mobile use, malformed inputs, offline failures and connection limitations. Update a per-module PASS/FAIL/BLOCKED matrix with exact test evidence.

Priority 2: Confirm whether focus label overlap, crowded weather high/low, unnecessary Tasks “Private,” and Approval & Activity panel still occur in the 4.5.2 UI. Fix only reproducible current problems.

Priority 3: Run build, unit/API and all historical/new E2E scripts detailed in `CODEX_START_HERE.md`. Confirm current CI and report counts for this HEAD, not reused historical totals. Device-authenticated Spotify, ICS/Google, mail/Drive, eBay, microphone and real media require local acceptance.

Priority 4: Open a safe PR for verified fixes, update handoff documents, and report build/deployment separately. Keep scene-first Home, saved layout compatibility, backup and classic-home fallback intact.

**Repo organization:** Old branches are historical safety snapshots and MUST NOT be deleted without unique-commit comparison. Do not rewrite the V2 default `main` or claim its contents are current. Do not overwrite Mac private configuration.
