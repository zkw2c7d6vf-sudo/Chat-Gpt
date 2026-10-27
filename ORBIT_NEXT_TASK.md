# Next task after the Orbit 4.6 completion pass

Start with `CODEX_START_HERE.md` and `AGENTS.md`. Use **`feat/orbit-v4.6`**, whose implementation checkpoint is `cc3d587e4f77bc2162228ab40ff60c7e510f598e`; do not restart from historical `main` or overwrite newer 4.5.2 work.

1. Inspect this branch's current HEAD, dirty files, new PR and final GitHub validation result. The detailed completed-work/evidence matrix is in `docs/v4.6-review.md`. Reuse successful checks unless affected code or unresolved failures justify rerunning them.
2. **Highest-value next action: Mac acceptance of the original Shopping search.** A quota-triggered baseline crash was reproduced and repaired, with search/offer retry and reload tests. The exact cause on Joe's device remains unverified. If it persists, obtain the precise console exception and browser storage condition; do not expose tokens.
3. With Joe's existing private configuration, verify actual Spotify device playback, calendar subscription/import, Gmail/Drive consent, optional eBay, microphone/audio and representative original media. Mocked tests cannot certify these.
4. If new defects are found, reproduce and fix them narrowly; preserve all records, classic Home, background exclusions, prior branches and the frame-scheduled drag path. No unrelated feature expansion, branch deletion, release merge or production deployment.

PR #5's guarded-write/warning intent is incorporated with additional recovery coverage; its branch has not been merged or deleted. PR #4 and old releases are retained as historical checkpoints. Publish source and install on the Mac are separate actions.
