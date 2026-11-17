# Midnight glass redesign — November 17, 2026

The home now has a large centered clock, Spotify, weather and next calendar event. A small dock opens Calendar, Tasks, Focus, Room, Read and Inbox. Capture and Search are separate header actions. Spaces and the large Today section are no longer loaded. Existing local storage formats and capture persistence are unchanged.

Automatic appearance follows prefers-color-scheme and responds to system changes. Dark and Light can also be chosen explicitly; Rain and Winter remain optional. Physical lamp colors and the official Spotify artwork/logo are preserved.

## Validation

- 42 Python tests passed: backend isolation, request validation, integrations, caching, restore and update preservation/rollback.
- 24 Node tests passed: focus persistence, weather day selection, capture/restore validation, command search and task/focus UI behavior. Four are retained tests for the retired Spaces storage module, which is no longer loaded by the app.
- All JavaScript syntax and local static references checked by scripts/build.py.
- Real browser: 1440×900 dark home, 1024×768 light home; no horizontal overflow, distinct card/dock geometry. Floating Tasks, Focus, Room, Read, Calendar, Inbox and Search opened successfully.
- Created a synthetic task in a separate local test origin, saved it, linked/paused focus, and verified it appeared in Inbox. No real captures or drafts were used or changed.
- Live public-city weather lookup returned seven days; clicking Wednesday opened its own hourly forecast. Appearance selection and panels visually inspected. Manual city search remains reachable while geolocation is pending.

## Scope

Spotify remains the existing OAuth PKCE integration, with Premium/Spotify app access requirements. No playback was sent during tests. Weather, calendar and feeds retain their existing backend integrations and setup. Kasa device connections were blocked in the isolated browser server. No physical device was switched. No external accounts or services were modified.

The installer backs up replaced source. Server data preservation is verified during installation; browser capture databases remain on the same original app origin.

## Installed verification

Applied to the original installation; all three saved server data files verified byte-identical after the server stopped and source was replaced. Previous source is in upgrade-backups/20261117-112639-990736. The live Spotify connection reported no active player; no playback command was issued. Live weather and the next connected-calendar event rendered. A synthetic ICS import in the separate QA origin rendered its event and opened the correct date. A synthetic capture draft survived closing and reopening its editor.

The /app entry and versioned assets avoid the older offline shell while keeping the same origin and capture database. The service worker activates only after the entire new shell is cached; existing loaded pages keep their drafts and DOM until navigation. Mac and Windows launchers use /app.
