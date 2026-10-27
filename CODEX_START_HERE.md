# Orbit — Codex start here

**Current context handoff:** 2026-10-27. The user ran out of Codex context/storage and asked that every material decision since then be retained. **Read the following files in this order before changing code:**

1. [Full conversation catch-up](docs/CODEX_CONTEXT_CATCHUP_2026-10-27.md) — user quotes, preferences, version history, implementation status, known bugs and protection rules.
2. [Universal compact/expanded widgets specification](docs/CODEX_HOME_DYNAMIC_WIDGETS.md) — required behavior and test matrix for **all eleven Home widgets**, not just Priorities and Calendar.
3. [Machine-readable widget expansion contract](docs/home-widget-expansion-contract.json) — required compact/expanded states for each current widget; `tests/home-widget-spec-unit.test.mjs` verifies full manifest coverage, not implementation completeness.
4. [Home integration status and validation instructions](docs/ORBIT_IMMERSIVE_HOME_INTEGRATION.md) — branch, rollback, data preservation, background privacy and commands.
5. [GitHub PR #4](https://github.com/zkw2c7d6vf-sudo/Chat-Gpt/pull/4) — live diff, current CI, review discussion. Do **not** assume a previously cited commit is the latest head.
6. Actual sources: `src/App.tsx`, `src/ImmersiveHome.tsx`, `src/immersive-home.css`, `src/WeatherPanel.tsx`, `src/media/MediaCenter.tsx`, `src/backup.ts`, and the existing tests.

## What the user wants

A complete, reliable, fully usable Orbit Home, inspired by the immersive LifeAt workspace but keeping the original Orbit logo, Midnight Navy identity, time-based greeting, concise functional labels, real provider integrations, and the existing local-first records.

**There must be no Edit Layout mode.** Every window should move from its own header and offer click-to-front, drag, resize, maximize, minimize-to-dock, restore, close and reopen, with saved states per workspace. Backgrounds are selected through a searchable gallery with numerous options, not a bottom row of three presets. Spotify is named Spotify, weather is a separate five-day Home widget, and Email and Continue Watching use real Orbit data rather than fabricated examples.

**Additional, newest requirement:** Maximizing *every* widget changes the amount of real information or available controls, not just its pixel dimensions. Tasks compact→3 / expanded→all; Calendar compact→7 days / expanded→14+ days, and similarly meaningful modes for all other widgets. Read the universal contract for the full 11-widget matrix.

No motivational flavor text or decorative labels. Prioritize navigation by user importance, keep icon meaning clear, and keep full modules available.

## Current implementation is not a release certificate

The feature branch `feat/orbit-immersive-home-2026-10-26` branches from `orbit-v4.4`. PR #4 is a **draft**. Current Home has a working shared window manager and a first version of scene browsing, but **most widgets have not yet been wired to distinct expanded content**. The window manager now accepts `content: ReactNode | ((expanded: boolean) => ReactNode)`; extending this into a shared explicit compact/expanded render contract is the next key implementation job. This document does not claim that the current application has passed all CI or that it was installed on the user's Mac.

Historical `main` still contains v2. Never assume the repo branch is newer than the Mac checkout. Audit local uncommitted changes before pulling, checking out branches or merging. Preserve backups, storage keys, auth configuration, original integrations and the reversible classic Home (`?classic-home=1`).

## Codex's immediate bounded task

1. Audit the current checkout, recent commits, uncommitted changes, backup safety, and current GitHub CI failures. Do not reset/clean/force-push.
2. Run `npm ci && npm run build && npm test`. Start `npm run dev`, then `npm run test:home`, `npm run test:e2e`, `npm run test:v3`, `npm run test:v31` and `npm run test:v4`. Fix failures, preserving regression scope.
3. Implement universal, meaningful expanded states for **every one of the eleven existing Home widgets**, reusing original data stores and established providers. Use the required matrix in the spec, not guesses. Never use sample data outside explicitly labeled demo mode.
4. Test each window's compact → expanded → restored, minimize → dock → reopen, close → Widgets → reopen, refresh persistence, keyboard movement, mobile, provider-disconnected and error behaviors. Verify background search fallback and backup round-trip.
5. Update release notes and status documents with the exact tested commit, passing/failing checks, and remaining limitations. Only promote into `orbit-v4.4` after real CI and device/account verification. Never merge directly into the old `main` by default.

The user's target is a **ready-to-use build**, not another standalone concept. Be accurate: a GitHub branch and passing local unit tests are not deployment. No promise of later/background completion.
