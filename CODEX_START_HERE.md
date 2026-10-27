# Orbit — authoritative development entrypoint

- Repository: `zkw2c7d6vf-sudo/Chat-Gpt`.
- **Current development baseline: `feat/orbit-v4.6`**, package `4.6.0`. Implementation checkpoint: `cc3d587e4f77bc2162228ab40ff60c7e510f598e`; inspect current HEAD and PR validation before continuing.
- Previous release-source baseline `orbit-v4.5.2` and its newer handoff commits through `970f61c` are preserved and included. Historical `main` is V2 plus a redirect handoff; do not use it as the current product.
- PR #4 contains the previous Home release. Draft PR #5 (`0737f819`) identifies the Shopping storage-write risk; its intent is incorporated and exercised in 4.6 without merging or deleting that branch.

Read `AGENTS.md`, `ORBIT_STATUS.md`, `ORBIT_NEXT_TASK.md`, `ORBIT_CHANGELOG.md`, then `docs/v4.6-review.md`. Older architectural context is in `docs/v4.5-review.md`, `docs/CODEX_CONTEXT_CATCHUP_2026-10-27.md`, `docs/CODEX_HOME_DYNAMIC_WIDGETS.md` and the widget contract JSON. Inspect actual source, Git changes, remote heads and CI; historical claims are not new evidence.

Prioritize existing functional defects, especially the original Mac Shopping trigger, over product expansion. Reproduce before diagnosing. Conserve resources: focused checks during repair and one complete release checkpoint. The 4.6 CI includes `test:v46` and `test:shopping-storage` alongside the existing gates.

Preserve Midnight Navy, original branding, scene-first Home with three default panels, concise daily-tool dock, boxed search, dynamic widget expansion and classic Home (`?classic-home=1`). Read `docs/home-performance-review.md` before gesture changes: no per-pointer React/storage writes or desktop mounted-panel reordering.

Protect user data, private `.env`/`.orbit`, local media, backup exclusions and old branches. Keep education out of external AI. No mandatory paid services, main overwrite, reset, clean, force-push or unverified merge/deployment. Source on GitHub is not an automatic Mac update; account/device acceptance is separate from fixture and public API checks.
