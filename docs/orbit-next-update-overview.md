# Orbit 4.3 — Daily flow and planner

## Product goal

Make Orbit answer “What matters today?” quickly, then make it easy to plan the rest of the week. Keep the navy space identity, prioritize real connected or locally saved information, and avoid adding required paid services.

## Proposed experience

### Home: Today

Replace scattered overview status with one compact daily summary:

```text
TODAY · Wednesday, 9:12 AM
Next up       Tutoring · 10:30 AM
Priority      Finish lesson plan · High · due today
              Review budget · Normal
Weather       Buffalo · 58° · Light rain
Continue      Orbit media item or recent local note (only when available)
```

Show up to three priority tasks and the next calendar event. Weather stays on Home as Buffalo’s forecast. Do not render empty “continue” or activity cards. Each row opens its existing detail or action, so the summary does not create duplicate records.

### Planner: calendar and tasks together

Add optional due dates and priorities to tasks. The week view places dated tasks beside the existing read-only calendar events; undated tasks stay in an “Unscheduled” list. Task entry remains one-line and fast, with date and priority available as optional details. Completing or editing a task updates every view that shows it.

Example:

```text
WEDNESDAY
10:30  Tutoring                         Calendar
       Finish lesson plan · High        Task · due today
       Review budget · Normal           Task

UNSCHEDULED
Pick up groceries
```

Start with simple date selection and “Move to tomorrow.” Drag and drop can follow only if the basic planner remains clear and accessible on the MacBook and mobile layouts.

### Weather settings

Keep the forecast on Home. Move location search and temperature units into Joe’s profile & settings. Buffalo remains the default. Changing location refreshes the Home card and persists in this browser. The settings surface shows the selected city and current unit without making weather a separate navigation destination.

Home’s weather card is a seven-day forecast only. Show the current temperature prominently in the Today summary beside event and task information.

### Finances

Keep finances in a separate navigation section, never on Home. The first version is a local manual tracker for income and expenses, with a running net total and the ability to remove an entry. Do not connect bank accounts or infer financial information. Include entries in explicit Orbit backups, with validation on restore.

### Daily brief

Add an optional short “Your day” summary using only data Orbit already has: next event, due or overdue tasks, Buffalo weather, and current Spotify track when connected. Example: “Tutoring starts at 10:30. Your lesson plan is due today. Light rain is expected this afternoon.”

Keep it rule-based initially, so it works without AI credentials and does not send private calendar, task, or finance details to an AI provider. Include links to the source rows and a user-controlled dismiss/hide option. If AI summaries are explored later, require explicit opt-in and clearly identify the provider and data sent.

## Blueprint ideas to carry forward

- A compact Continue Deck for the most recent unfinished local media item or note, only when real resumable data exists.
- Shared task and calendar data with one source of truth; Home and Planner are views over the same records.
- Honest status and freshness for connected services, with useful retry behavior where supported.
- Preserve local-first tasks and preferences, existing Spotify/calendar integrations, backups, and established media playback.
- Keep Command/search and quick capture prominent, with keyboard and pointer access.
- Keep shopping comparisons explicit about source, shipping, and freshness; do not claim universal live retailer coverage.
- Keep stream providers as external links and preserve browser/media permissions; do not imply DRM playback support.

## Suggested delivery order

1. Audit and preserve current task, calendar, weather, and backup behavior.
2. Move weather location and unit controls into profile settings.
3. Add optional task due date and priority fields, including validation and a safe migration for existing browser data.
4. Build a compact week view using existing calendar events and task records.
5. Rework Home into the Today summary with a maximum of three surfaced tasks and conditional Continue content.
6. Add the rule-based Daily Brief and concise service freshness details.
7. Review all primary journeys, keyboard access, empty/offline states, mobile layout, and backup/restore behavior.

## Acceptance checks

- Existing tasks remain intact after the task schema change and after reload.
- A task can be created quickly without a due date, then edited with a date and priority.
- Calendar events remain read-only and are never duplicated as tasks.
- Completing or rescheduling a task is reflected in Home and Planner immediately.
- Home shows Buffalo weather by default; changing city/unit in settings updates Home and survives reload.
- Home stays useful with no calendar, no Spotify, and no media history; it does not show fake sample entries.
- Daily Brief uses only available values and labels missing services plainly.
- Existing ICS import/feed, Spotify, local media, shopping, backup, and assistant flows remain available.
- No new recurring costs are required. Optional provider credentials and any data sharing remain explicit.

## New idea: Orbit “departure check”

As a later optional Home card, Orbit could combine the next event’s time/location with the current weather and offer a small reminder such as “Tutoring at 10:30 · rain likely · leave a little earlier.” It should appear only when a calendar event has a usable location and the forecast supports the message. No background location tracking or push notification infrastructure is required for an initial version; a visible, dismissible card is enough. This is a proposal, not part of the 4.3 commitment.
