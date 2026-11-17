# Midnight project rules

Midnight is a local personal dashboard. Preserve its quiet clock-first home: Spotify, weather and next event, with a bottom dock opening floating tools. Nature uses a quiet local 4K video behind coordinated glass. Retain Black, Automatic light/dark, Rain video and Christmas. Keep muted playback, pause when hidden, respect reduced motion and preserve visible Pexels credits. Font choices must show real digit previews. No Spaces, planning banners or green UI. Keep semantic variables and large controls. Target desktop monitors and desktop touchscreens; the user explicitly does not want phone optimization.

- Keep critical repeated actions on the main screen or one secondary panel. A basic capture requires opening Capture and Save; typing and optional type/date choices are user input. Inbox actions require opening Inbox and selecting an action. Do not add nested navigation for routine actions.
- Ask for minimal setup once and remember choices. Capture requires no accounts. Request microphone access only after Dictate; language-pack downloads require their own explicit tap. Explain actual unavailable/error states next to their control.
- Preserve useful local behavior without internet. Capture, drafts, saved preferences and the focus timer cannot depend on external integrations. Do not add paid APIs or silently upload speech or captures.
- Use large touch targets (44px minimum for primary actions, 48–56px keyboard key heights on touch displays), visible keyboard focus, accessible labels and reduced-motion support. Keep save/close actions reachable at small sizes.
- Persist before reporting success. Retain user input on failures. Keep archive reversible, and never modify private data or physical devices during tests.
- Verify the actual implementation; distinguish simulated voice tests from a real microphone check. Run capture browser tests and relevant existing tests, and inspect full desktop and compact desktop-window layouts for interface changes.

Architecture: FastAPI `server.py`, vanilla JS/CSS in `static/`. Capture is isolated in `capture-store.js` and `capture.js`, uses IndexedDB and has no backend/account dependency. Do not replace the app with a different framework.
