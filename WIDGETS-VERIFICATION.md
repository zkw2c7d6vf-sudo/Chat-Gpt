# Main widget refinement · November 17, 2026

The existing clock-first home, themes and local captures are retained. No real reminder or capture was edited or removed.

## Spotify

The record and device footer open a Now playing panel. It includes track/album/year, transport, seek, shuffle, repeat, device information and volume. Healthy idle accounts show “Start a song in Spotify” and hide Reconnect; HTTP 401 shows the reconnect action. Provider disallow flags and unsupported volume disable their controls. All changes require an explicit user action and the existing playback scopes; no new scopes are requested. Seeking is bounded to the current track so seeking to its end cannot accidentally skip into another song. Premium and endpoint/development-mode access still apply. Endpoint errors are shown in the panel. No audio is streamed by Midnight.

## Weather

The town heading remains. The decorative empty orb is replaced by a real condition icon that opens today's details. A next-12-hours rain probability outlook is derived from forecast hours, not presented as a guarantee. Highs and lows occupy separate rows under each day, with dimmer lows. Daily details add maximum wind, UV index and precipitation totals for the selected day. The last-check time and failed-refresh state remain truthful. A location change during an in-flight fetch cannot apply the previous location's forecast.

## Calendar

Up next shows a live countdown, date/time, location, one following event and a remaining-today count. Ongoing timed events are prioritized; all-day events retain date context. Tapping opens read-only event details with notes, copy, an optional map link and a direct handoff to its date in the calendar. Calendar text is never inserted as HTML. Duplicate and expired events are excluded. A cached calendar is labeled when refresh fails.

## Notifications and counts

Notifications occupy the upper-right corner, clear of the card/dock stack. The bell counts unread updates from this visit; Inbox counts non-archived unfinished captures. Their tooltips/accessibility labels identify those different meanings. Existing real reminder text is preserved.

## Checks

- 69 Python checks: existing backend/data preservation and rollback checks plus strict playback command validation, seek bounds/restrictions calendar notes, and verified asset downloads.
- 31 Node checks: existing capture/timer/weather rules plus calendar projections, countdown/timezone behavior, rain outlook/missing data and in-flight weather location changes.
- Browser testing uses an opt-in synthetic fixture in a temporary data directory. Spotify requests, weather and calendar events are simulated, and physical-device connections are blocked. It exercises the real backend command routes and frontend UI without any live playback writes.
- Browser: seeking, volume, shuffle and repeat read back successfully; healthy-idle hides Reconnect and expired sign-in shows it. Event notes and correct-date calendar handoff verified. Weather details show all six daily metrics. Compact 1024×768 has no horizontal overflow and clear card/dock separation. Reminder placement and distinct count labels checked with an isolated synthetic reminder.
- Live authenticated Spotify writes, clipboard copying, map navigation and Windows hardware are not exercised. Read-only inspection of the installed dashboard verifies the final layout and preserved connections. New controls depend on Spotify allowing the corresponding endpoints.

References: https://developer.spotify.com/documentation/web-api/reference/seek-to-position-in-currently-playing-track , https://developer.spotify.com/documentation/web-api/reference/set-volume-for-users-playback , https://developer.spotify.com/documentation/web-api/reference/toggle-shuffle-for-users-playback , https://developer.spotify.com/documentation/web-api/reference/set-repeat-mode-on-users-playback , https://open-meteo.com/en/docs .
