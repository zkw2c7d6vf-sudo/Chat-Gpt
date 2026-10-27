# Orbit — next bounded Codex task

**Task:** Complete meaningful compact/expanded behavior for **all eleven** Home widgets and verify safe release from feature branch.

**Before editing:** read `CODEX_START_HERE.md` and both Codex docs fully; inspect actual checkout, `git status`, original data/backup, provider contracts, PR #4, CI logs. Do not destroy or overwrite unknown local changes. Preserve `?classic-home=1` as rollback.

## Implementation
1. Introduce a common typed `render({mode, availableWidth, availableHeight, workspace})` widget-content contract (adapt current `content: ReactNode | ((expanded:boolean)=>ReactNode)`). Make expanded state apply consistently to **every widget**, including all future additions.
2. Using original Orbit stores, implement semantic compact → expanded differences from the table in `docs/CODEX_HOME_DYNAMIC_WIDGETS.md`. **No expanded view may simply stretch its compact card.**
3. Specifically: Priorities 3→all unfinished (preserve actions and priorities), Calendar 7→14+ days and multi-day agenda, Weather 5→7 days/extra details, Email 3→up to 30 real messages, Continue Watching 1→multiple real resumable items; Focus, Spotify, Notes, Ambient, Files and Up Next also require meaningful expanded content/actions.
4. Avoid duplicated records, provider fetches on each drag frame, invented account data, new paid APIs, excessive nested headers, flavor text or decorative widgets. Preserve available icons, original logo, dynamic greeting, saved scene, local weather units, user notes and Focus state.
5. Test expand/restore geometry, drag/minimize/dock/close/reopen, persistence and backup, mobile/keyboard behavior, provider missing/error/demo states. Add explicit tests of the additional content in all eleven widgets.
6. Run full GitHub Actions gate, smoke-test actual connected accounts and Mac origin, then document evidence in `ORBIT_STATUS.md` / `ORBIT_CHANGELOG.md` before requesting review.

## Output required from Codex
- Exact commit SHA / diff summary.
- For each widget: compact content, expanded content, source, verified tests, known limitations.
- Build/unit/browser pass/fail and any CI links.
- Screenshots or equivalent evidence for desktop/mobile, with accessibility issues noted.
- Backup and rollback evidence.
- A truthful release decision: **ready / blocked**, with remaining blockers and no premature merging.

Other roadmap modules are out of scope. Do not merge directly into old `main`.
