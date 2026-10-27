# Orbit development rules

These permanent rules come from the user's Orbit 4.6 master handoff (2026-10-27).

- Read `CODEX_START_HERE.md`, `ORBIT_STATUS.md`, `ORBIT_NEXT_TASK.md`, `ORBIT_CHANGELOG.md`, and the relevant release review before editing. Inspect actual code, Git heads, dirty files, open PRs and CI; historical `main` is not the current app.
- Prioritize crashes, data loss and incomplete existing workflows before integrations, presentation and performance. Do not start unrelated product expansion or redesign working components unnecessarily.
- Reproduce defects and identify their cause. Make precise changes; never invent implementation claims, records, test results, provider access or deployment.
- Preserve credentials, private configuration, browser storage, local media, backups, old branches, classic Home and existing integrations. No reset, clean, force-push, unknown-file overwrite, branch deletion or unverified release merge.
- Keep Midnight Navy, original Orbit branding, sparse scene-first Home, concise daily-tool dock, labeled search, dynamic widget expansion and smooth frame-scheduled dragging with one drop save.
- Keep education records out of external AI requests. No mandatory paid service. Account access, spending and production deployment require explicit authorization.
- Work autonomously within authorized scope. Batch related inspection and changes. Use focused verification, existing tests and regression coverage for meaningful defects. Run full regression gates at a release checkpoint, preferably CI; do not repeatedly rerun successful unrelated suites or chase arbitrary test counts.
- Distinguish code implementation, automated fixtures, actual public API responses, authenticated account/device verification and external blockers.
- Save progress to GitHub and update status, next-task and changelog with exact commits, observed results, remaining blockers and the highest-value next action. Keep one authoritative development baseline and concise linked supporting documentation.
