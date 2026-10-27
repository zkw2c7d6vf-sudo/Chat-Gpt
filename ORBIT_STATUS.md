# Orbit implementation status — 2026-10-27

**Source of truth:** actual checked-out files, GitHub PR #4 and current workflow run logs, not prior assistant promises.

## Repository / release status
- Development base: `orbit-v4.4`. Historical `main` is older v2 and must not be overwritten.
- Active development branch: `feat/orbit-immersive-home-2026-10-26`.
- Review: [PR #4](https://github.com/zkw2c7d6vf-sudo/Chat-Gpt/pull/4) is a **draft**, unmerged into the base branch and not deployed to the user's Mac.
- Latest known confirmed green **application validation**: GitHub Actions run [40449078392](https://github.com/zkw2c7d6vf-sudo/Chat-Gpt/actions/runs/40449078392), commit `918deaf1`: TypeScript/Vite build, unit/server tests, new Home E2E, V2 E2E, V3 E2E, V3.1 E2E and V4 E2E passed. Newer documentation-only commits and workflow trigger changes need their current check verified; do not claim a later SHA passed without evidence.
- Local Mac checkout, saved browser storage origin, installed secrets and live provider behavior: **not independently verified**.

## Implemented in the feature branch
- LifeAt-inspired immersive Home workspace with Orbit branding and time-of-day greeting retained from App.
- Window manager: direct drag/resize (desktop), minimize/dock/reopen, close/show, maximize/restore, click-to-front, keyboard behavior, mobile stack and workspace-specific saved layouts.
- Backgrounds: 36 built-in gradient scenes, searchable Wikimedia Commons photo lookup, personal image input and selected scene persistence.
- Eleven embedded widget surfaces with preexisting Orbit data: Up Next, Priorities, Focus, Spotify, Weather (five days), Email, Continue Watching, Notes, Calendar, Ambient, Files.
- Legacy fallback `?classic-home=1`. New Home storage included in Orbit backup with personal uploaded scene bytes excluded. HTTP LAN UUID fallback fix.
- Type bridge to dynamic widget content: `HomeWidget.content: ReactNode | ((expanded: boolean) => ReactNode)`.

## Not yet implemented / not yet verified
- **Dynamic richer expanded mode for every widget** remains the user's main new requirement. Most App widget entries still pass static content rather than expanded-mode variants; basic maximize functionality **does not satisfy** this task.
- Exhaustive e2e tests for every widget's content delta, pointer accessibility, responsive change, and data-sharing integrity.
- Production deployment to the user's Mac and authenticated live integrations (Spotify, Gmail, calendar, home Jellyfin server etc.).
- New unrelated roadmap modules (Education HQ, File Studio expansion, broad retailer/provider integrations) are not in scope for this Home release.

## Release gate
Do not mark ready-to-use until the latest branch SHA passes clean build, unit, browser regressions, all-widget compact/expanded acceptance tests, actual backup/restore and local-device/provider smoke checks; ensure no newer local work is overwritten.

Read: `CODEX_START_HERE.md` → `docs/CODEX_CONTEXT_CATCHUP_2026-10-27.md` → `docs/CODEX_HOME_DYNAMIC_WIDGETS.md`.
