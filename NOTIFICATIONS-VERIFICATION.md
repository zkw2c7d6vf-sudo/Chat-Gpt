# Notifications and shared material styling — November 16, 2026

Implemented in the existing Midnight application. Desktop remains the intended target.

## Notification behavior

Reminders, Space suggestions, offline status, transient success/error messages and Focus
completion now use one fixed bottom dock. The main dashboard has its own scroll viewport
ending above that dock. Its height is reserved even when there are no messages, so receipt,
expiry, unread counts, dismissal and history do not alter widget layout.

Nothing automatically opens over the widgets. Notification history opens only when the
Notifications button is activated; it is a non-modal popover and never reflows the grid.
Outside actions remain usable. Notifications do not trigger Space changes, device controls
or other callbacks without an explicit action. Focus completion is a small check animation
inside the dock instead of an overlay. It does not take focus from typing.

The dock follows the active native dialog in the top layer, remaining usable while that
panel is open. Dialogs reserve the same bottom region so Save/Close controls are not covered.
Live announcements are inside the active surface. Repeated reminders are deduplicated;
a changed due count can notify again after dismissal. Clearing past updates leaves active
ongoing notices available. History is capped at 40 entries and lasts until page reload.
No OS notification permission, account, upload, sound or background service was added.

## Material refactor

Shared CSS now uses theme-based translucent gradients with
`backdrop-filter: blur(20px) saturate(180%)`, consistent 20px main-card corners, 24px panel
corners, soft multi-layer shadows and a 1px inner highlight. Dark mode uses the requested
white 0.1 highlight; light themes use a lighter shadow treatment. Nested cards use 16–20px
radii and consistent spacing. Navigation, notification history and dialogs use the same
material tokens. Decorative borders and duplicated card treatments were reduced.

Reduced-motion, reduced-transparency and increased-contrast preferences have CSS fallbacks.
The Search/Capture switch is now part of the shared panel header, leaving more room for
writing and the touch keyboard.

## Files

- New: `static/notifications.js`, `static/notifications.css`, `tests/notifications.e2e.cjs`.
- Updated producers: `static/app.js`, `static/capture.js`, `static/spaces.js`, `static/ui.js`.
- Updated surfaces: `static/index.html`, `static/polish.css`, `static/command-spaces.css`,
  `static/icons.js`. Old top-of-dashboard notification elements were removed.
- `sw.js` is version v5 and precaches both notification assets.
- Existing browser tests now target dock actions instead of removed banners; the notification
  component's data attribute is distinct from Capture's content-type attributes.

## Validation

- New browser checks passed across **20 Space/display combinations** (all four Spaces at
  1024×768, 1280×720, 1366×768, 1440×900 and 1920×1080). Exact widget rectangles remain
  unchanged on notification arrival, opening history and dismissal.
- Verified no automatic callback execution/Space changes, no automatic history popup,
  dock/modal separation, preserved capture input and keyboard focus, usable dismiss/history
  controls during a dialog, outside-widget actions, unread/read state, history bounds,
  repeat suppression and changed reminder counts.
- All ten themes and reduced motion passed. Computed CSS confirms the requested blur,
  inner highlight and 20px card radius. Dark and Sand previews were visually inspected.
- **18 JavaScript tests passed.** Existing Capture, Focus UI, Command/Spaces, general UI,
  desktop geometry and real-backend calendar browser suites also passed during this update.
- The desktop geometry suite still rejects intersecting cards and clipped primary controls.
  The calendar browser suite still imports real ICS files against a temporary FastAPI data
  directory and verifies future/past dates and reload persistence.
- The production build validates JavaScript syntax/Python parsing and packages a clean source
  distribution with checksums. User data, accounts and normal browser profiles are excluded.

Backend code was unchanged in this update. Physical touchscreen hardware, real microphone,
Safari and Firefox were not tested. These are in-app notifications, not background OS alerts.
The user's running dashboard was not restarted or used for account/device writes.

Close all old Midnight tabs and reopen to activate the v5 cached interface.
