# Orbit V2 build handoff

This handoff deliberately carries project context into Orbit. It is a saved document, not a connection to ChatGPT history or memory. Update it when project requirements or verified outcomes change. Do not put credentials, private calendar subscription URLs, or account tokens here.

## User and environment

- Joseph is running Orbit locally on a MacBook after downloading the project from GitHub.
- The development app uses the browser origin `http://127.0.0.1:5173`.
- Joseph reported that Spotify is connected and working. Preserve `.env`, `.orbit`, and the same browser/site data during upgrades.
- Google OAuth setup was abandoned after a Google Cloud free-trial prompt. Prefer an ICS/iCalendar subscription or a `.ics` file import for calendar access. Do not pressure the user into a billing trial.
- Real Gmail and Drive access is still separate from calendar-feed access and requires a supported authenticated integration.

## V2 priorities

1. Show practical dashboard information first: schedule, important mail, Spotify, weather, and tasks.
2. Remove the large decorative banner. Make the central graphic useful: a friendly assistant character with clear listening/thinking/speaking states and a prominent talk control.
3. Default weather to Buffalo, New York, with city search and Fahrenheit/Celsius controls.
4. Support private ICS subscription links and `.ics` imports without Google Cloud OAuth.
5. Make voice dictation understandable and dependable, with permission guidance, draft review before sending, and a supported transcription fallback when configured.
6. Keep project to-dos based on this conversation and real build follow-ups, preserving the user's existing list.
7. Explain the AI boundary honestly: Orbit can use OpenAI's API, but cannot inherit this ChatGPT subscription, session, tools, or memory.

## Follow-ups requiring Joseph's local access

- Add a private calendar subscription in Orbit or import an exported `.ics` file. Do not share its private URL in chat.
- Check Buffalo weather and try another city on the Mac's network.
- Allow the browser microphone and test dictation in the updated app.
- If conversational AI or recorded transcription is wanted, configure a private OpenAI API key and separate API billing. Do not paste the key in chat.
- Keep the connected Spotify account and test playback from an active Spotify device after upgrading.

These are build follow-ups, not a claim that Joseph has other personal errands. Checking an item in Orbit is a user action, not independent proof that a provider is working.

## Continuity rules

- Orbit does not monitor future ChatGPT conversations or automatically update the copy installed on the Mac.
- A future build should explicitly update this handoff and its versioned checklist, without overwriting user-created tasks, completion choices, notes, account settings, or tokens.
- The assistant can use only the dashboard context sent to it and any history the app retains. It must identify missing information instead of pretending to know private life details.
- Never claim an email was sent, an event changed, a service connected, or a task completed unless the corresponding action actually succeeded.
- Keep sample data, configured integrations, and verified live service results distinct.
