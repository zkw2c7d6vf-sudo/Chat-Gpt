# Orbit — authoritative Codex entrypoint (updated 2026-10-27)

## Repository truth
- Repository: zkw2c7d6vf-sudo/Chat-Gpt
- **Authoritative release-source branch: `orbit-v4.5.2`**. The default `main` branch still contains historical V2; do NOT base new work on `main`.
- Active release review: PR #4 (scene-first Home and v4.5.2); its head is `feat/orbit-immersive-home-2026-10-26`.
- Targeted Shopping Scout storage safety fix: draft PR #5, branch `fix/orbit-v452-shopping-storage-safety-20261027`, commit `0737f8192c0e239d14f06c82614074284719a591`. The original user-reported search crash has NOT been fully reproduced or proven fixed. Test before merging.
- DO NOT assume a GitHub branch is deployed to the user's Mac or public site.

## Immediate Codex assignment
1. Confirm current branch, head SHA, working tree, PRs and CI before modifications. Preserve user changes and existing .env/.orbit/localStorage, backups and older branches.
2. Start from `orbit-v4.5.2` and review PR #5. Reproduce Shopping Scout search crash, check storage exception handling, add regression tests, and fix the actual trigger. Verify search, saved comparisons, blank/duplicate input and API failure.
3. Audit every implemented module with an evidence table: Home, Tasks, Calendar/Planner, Focus/Ambient, Shopping Scout, Media, Education, File Studio, Finances, Notes, Weather, Spotify, settings, backups. Mark WORKING, PARTIAL, BROKEN, MOCK-ONLY or UNVERIFIED rather than inventing pass results.
4. Check user-reported UI issues against latest source: focus timer redundant label, weather high/low crowding, Tasks unnecessary Private label, and Approval & Activity panel. Only change if still present. Add targeted visual/browser coverage.
5. Run `npm ci`, `npm run build`, `npm test`, start dev server, then `npm run test:interaction`, `npm run test:scene`, `npm run test:home`, `npm run test:v45`, `npm run test:e2e`, `npm run test:v3`, `npm run test:v31`, `npm run test:v4`. Collect exact counts and failing assertions. Tests run against mocks do not establish live provider access.
6. Repair confirmed defects in a dedicated branch/PR; update ORBIT_STATUS.md and ORBIT_NEXT_TASK.md with reproducible evidence and commit IDs. No production deployment, release merge or history rewrite without separate validation.

## Product and design guardrails
- Scene-first Midnight Navy Home, original Orbit logo and local-time greeting; Today begins with three panels, not eleven. Dock stays concise and search visibly labeled.
- Preserve smooth animation-frame dragging with one final layout save, no pointer-per-frame storage writes or mounted-panel DOM reordering. Read `docs/home-performance-review.md` and `docs/home-rebuild-review.md`.
- Preserve the typed compact/expanded widget contract and classic Home at `?classic-home=1`.
- No mandatory paid APIs or fake provider data. Protect private credentials, education records, browser state and local media.
- Don't delete old branches or merge V2 `main` as a cleanup shortcut.

## Read next
1. `ORBIT_STATUS.md` and `ORBIT_NEXT_TASK.md`
2. `docs/v4.5-review.md`
3. `docs/CODEX_CONTEXT_CATCHUP_2026-10-27.md`
4. `docs/CODEX_HOME_DYNAMIC_WIDGETS.md` and `docs/home-widget-expansion-contract.json`
5. `ORBIT_CHANGELOG.md`, latest GitHub workflow results and both open PRs.
