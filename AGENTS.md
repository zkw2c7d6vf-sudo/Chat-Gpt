# Midnight project rules

Midnight is a local personal dashboard. Preserve its quiet clock-first home: Spotify, weather and next event, with a bottom dock opening floating tools. Nature uses a quiet local nature video, defaulting to 1080p with optional 4K behind coordinated glass. Retain Black, Automatic light/dark, Rain video and Christmas. Keep muted playback, pause when hidden, respect reduced motion and preserve accurate visible footage credits. Pixabay is the only online video provider; existing bundled footage retains its original attribution. Font choices must show real digit previews. No Spaces, planning banners or green UI. Keep semantic variables and large controls. Target desktop monitors and desktop touchscreens; the user explicitly does not want phone optimization.

- Keep critical repeated actions on the main screen or one secondary panel. A basic capture requires opening Capture and Save; typing and optional type/date choices are user input. Inbox actions require opening Inbox and selecting an action. Do not add nested navigation for routine actions.
- Ask for minimal setup once and remember choices. Capture requires no accounts. Request microphone access only after Dictate; language-pack downloads require their own explicit tap. Explain actual unavailable/error states next to their control.
- Preserve useful local behavior without internet. Capture, drafts, saved preferences and the focus timer cannot depend on external integrations. Do not add paid APIs or silently upload speech or captures.
- Use large touch targets (44px minimum for primary actions, 48–56px keyboard key heights on touch displays), visible keyboard focus, accessible labels and reduced-motion support. Keep save/close actions reachable at small sizes.
- Persist before reporting success. Retain user input on failures. Keep archive reversible, and never modify private data or physical devices during tests.
- Verify the actual implementation; distinguish simulated voice tests from a real microphone check. Run capture browser tests and relevant existing tests, and inspect full desktop and compact desktop-window layouts for interface changes.

Architecture: FastAPI `server.py`, vanilla JS/CSS in `static/`. Capture is isolated in `capture-store.js` and `capture.js`, uses IndexedDB and has no backend/account dependency. Do not replace the app with a different framework.

- Home widgets in the same row share a common height and align at both edges. Their widths can vary. When extra content needs room, make space for the whole row. Tapping a non-interactive area opens the corresponding detail popup. Existing controls keep their own actions.

- Included scene paths and attribution come only from `static/wallpapers/scenes.json`; never duplicate that table in JS or Python. A source clone supports still backgrounds without MP4s. Preserve original credits; Pixabay is the only online scene provider.
- Efficient effects use no backdrop filters. Optional glass caps its blur at 18px. Pause motion when another window is focused by default, with a remembered visible-window override.
- New installations have no warmer IP. Preserve saved setup; require an explicit valid LAN address before enabling device access. Never return saved secret calendar URLs in bootstrap/settings responses; an empty unmodified replacement input keeps the saved subscription.

- Spotify home uses a centered record without a sleeve or tonearm. Keep elapsed and total track time visible above the seek line. Recent albums and recent playlists are distinct deduplicated views with spaced, scrollable covers. Sounds is a direct dock play/pause action with an active rain ring and inline volume; its secondary arrow opens optional recording choices.
