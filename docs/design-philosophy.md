# Orbit design philosophy

Orbit is Joe’s private dashboard for orientation and action. It should make the next useful thing easy to see without trying to simulate a life, a coworker, or a spaceship.

## 1. The day is the interface

The opening screen answers four questions at a glance: what time is it, what is next, what needs attention, and what is already connected. Calendar, tasks, weather, music, and focus earn their position through daily use. Secondary spaces remain one navigation action away.

## 2. Calm is a functional requirement

Navy surfaces, muted steel-blue borders, and restrained orbital marks establish place without becoming decoration. There are no cartoon characters, illustrated heroes, fake activity, or looping novelty animation. Motion should confirm an interaction or communicate state, and it must respect reduced-motion preferences.

## 3. Readability beats density

Orbit uses normal browser zoom as its baseline. Supporting labels are quiet, but essential text, controls, schedule items, and status messages must be easy to read. The clock is a deliberate anchor: it pairs the current time with a time-of-day icon to make the dashboard feel present without adding prose.

## 4. Personal means user-authored

Joe’s name, actual schedule, tasks, notes, goals, habits, media, and shopping research belong in Orbit only when he adds or connects them. Empty states acknowledge missing data plainly. The product never fills gaps with invented assignments, income, purchases, messages, or recommendations.

## 5. Honest boundaries create trust

Each panel states what it can do. A private ICS import is a real calendar snapshot; Google mail requires Google consent; Spotify controls an active eligible device; browser speech depends on browser support. Shopping Scout compares listings Joe saves. It does not imply live cross-store coverage, price scraping, account access, or personalized tracking that does not exist.

## 6. Private by default

Credentials and provider tokens remain in local private storage, never source files or portable backups. Private URLs are treated as secrets. Local browser data can be backed up selectively, and integrations remain opt-in. Product UI does not invite users to paste secrets into chat fields.

## 7. Build in useful layers

New ideas begin as a narrow, reliable core. Shopping starts with saved searches and user-entered listing comparisons. It can grow into live comparison only when Orbit has approved, stable product data sources and can explain coverage, freshness, and affiliate relationships. The same rule applies to every future service.

## Interaction checklist

- A screen has one obvious primary action.
- Labels use plain verbs and familiar nouns.
- Errors name the next corrective action.
- External links open safely in a new tab and identify the destination.
- Local changes save predictably and are recoverable through backup where appropriate.
- Every integration has a useful disconnected state.
