# Orbit next task after 4.5.1

Review the rebuilt Home against the user’s supplied screenshot: scene-first, sparse contextual panels and a dock. See `docs/home-rebuild-review.md`. Do not restore the eleven-open-window default.

The immersive Home expansion, Education Center, weekly Planner and supported File Studio tools are implemented. Read `docs/v4.5-review.md` and `ORBIT_STATUS.md` before changing code. The original product requirements remain in the catch-up and dynamic-widget contract documents.

1. Test the 4.5 download from a separate Mac folder using the existing private configuration and same browser origin.
2. Verify actual Spotify device playback, Google/ICS calendar, Gmail and Drive consent, optional eBay credentials, microphone/browser support and original local media on the Mac.
3. Review PR #4 and latest CI. Preserve classic Home and old branches. Do not replace `main` or merge unverified changes.
4. Address concrete user feedback with targeted regression tests. All future widgets must specify and implement meaningful compact/expanded behavior.

Jellyfin, LMS integration, PDF/Office/video conversion, banks and delivery-provider connections require separate scoped work. Do not invent access or copy student records into AI context.
