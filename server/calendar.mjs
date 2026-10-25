import ICAL from "ical.js";
import { createHash } from "node:crypto";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ITERATIONS = 50000;
const MAX_COMPONENTS = 5000;
const MAX_EVENTS = 200;

function safeLink(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

// Most feeds include VTIMEZONE. Some omit it and use an IANA identifier; Intl
// supplies the correct historical/DST offset without a bundled timezone database.
function inTimeZone(value, timeZone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error(
      "The calendar uses an unsupported timezone. Export a calendar with timezone definitions included.",
    );
  }
  const wall = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
  );
  let instant = wall;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, Number(p.value)]),
    );
    const offset =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ) - instant;
    const next = wall - offset;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function dateValue(value, event, property = "dtstart") {
  if (!value)
    throw new Error(
      "The calendar contains an event without a valid start date.",
    );
  if (value.isDate) return new Date(value.year, value.month - 1, value.day);
  const tzid =
    event.component.getFirstProperty(property)?.getParameter("tzid") ||
    event.component.getFirstProperty("dtstart")?.getParameter("tzid");
  const result =
    tzid && (!value.zone || value.zone.tzid === "floating")
      ? inTimeZone(value, tzid)
      : value.toJSDate();
  if (!Number.isFinite(result.getTime()))
    throw new Error("The calendar contains an invalid event date.");
  return result;
}

function dateString(value, event, property) {
  if (value.isDate)
    return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
  return dateValue(value, event, property).toISOString();
}

function cancelled(event) {
  return (
    String(
      event.component.getFirstPropertyValue("status") || "",
    ).toUpperCase() === "CANCELLED"
  );
}

/** Parse a bounded ICS document into the dashboard's next fourteen days. */
export function parseCalendar(content, { now = new Date(), days = 14 } = {}) {
  if (
    typeof content !== "string" ||
    Buffer.byteLength(content, "utf8") > MAX_BYTES
  )
    throw new Error("Calendar files must be text and no larger than 2 MB.");
  if (!content.trim()) throw new Error("The calendar file is empty.");
  let calendar;
  try {
    calendar = new ICAL.Component(ICAL.parse(content.replace(/^\uFEFF/, "")));
    if (calendar.name !== "vcalendar") throw new Error();
  } catch {
    throw new Error(
      "This is not a valid ICS calendar. Use a calendar subscription link or an exported .ics file.",
    );
  }
  const components = calendar.getAllSubcomponents("vevent");
  if (components.length > MAX_COMPONENTS)
    throw new Error(
      "This calendar contains too many events. Export a smaller date range.",
    );
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + Math.min(90, Math.max(1, days)));
  const groups = new Map();
  const events = [];
  const emitted = new Set();
  let iterations = 0;
  let visited = 0;
  try {
    for (const component of components) {
      const event = new ICAL.Event(component, {
        exceptions: [],
        strictExceptions: true,
      });
      const key = event.uid || `untitled-${visited++}`;
      const group = groups.get(key) || { master: null, exceptions: [] };
      if (event.isRecurrenceException()) group.exceptions.push(event);
      else if (
        !group.master ||
        Number(event.sequence || 0) >= Number(group.master.sequence || 0)
      )
        group.master = event;
      groups.set(key, group);
    }
    const append = (event, start, end, occurrence) => {
      if (cancelled(event)) return;
      const from = dateValue(start, event);
      const until = dateValue(end, event, "dtend");
      if (until < from)
        throw new Error(
          "The calendar contains an event that ends before it starts.",
        );
      if (from >= rangeEnd || (until <= rangeStart && from < rangeStart))
        return;
      const id = createHash("sha256")
        .update(`${event.uid || "event"}:${occurrence || start.toString()}`)
        .digest("hex")
        .slice(0, 24);
      if (emitted.has(id)) return;
      emitted.add(id);
      const url = safeLink(event.component.getFirstPropertyValue("url"));
      const location = String(event.location || "").slice(0, 1000);
      const description = String(event.description || "");
      const meeting = [
        url,
        ...`${location} ${description}`.matchAll(/https?:\/\/[^\s<>"\\]+/g),
      ]
        .map((value) => safeLink(Array.isArray(value) ? value[0] : value))
        .find((value) =>
          /https:\/\/(meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com)\//i.test(
            value,
          ),
        );
      events.push({
        id,
        title: String(event.summary || "Untitled event").slice(0, 500),
        start: dateString(start, event),
        end: dateString(end, event, "dtend"),
        allDay: Boolean(start.isDate),
        location,
        ...(url ? { url } : {}),
        ...(meeting ? { meetingUrl: meeting } : {}),
      });
    };
    for (const { master, exceptions } of groups.values()) {
      if (!master) {
        for (const exception of exceptions)
          if (!cancelled(exception))
            append(
              exception,
              exception.startDate,
              exception.endDate,
              exception.recurrenceId?.toString(),
            );
        continue;
      }
      if (cancelled(master)) continue;
      for (const exception of exceptions) master.relateException(exception);
      if (master.isRecurring()) {
        const iterator = master.iterator();
        let occurrence;
        while ((occurrence = iterator.next())) {
          if (++iterations > MAX_ITERATIONS)
            throw new Error(
              "The calendar recurrence is too large to expand safely. Export a smaller date range or a recent calendar.",
            );
          // A recurrence overridden to an earlier date is handled separately below.
          if (dateValue(occurrence, master) >= rangeEnd) break;
          const exception =
            master.exceptions[occurrence.toString()] ||
            master.exceptions[
              occurrence.convertToZone(ICAL.Timezone.utcTimezone).toString()
            ] ||
            master.exceptions[master.findRangeException(occurrence)];
          if (exception && cancelled(exception)) continue;
          const details = master.getOccurrenceDetails(occurrence);
          append(
            details.item,
            details.startDate,
            details.endDate,
            occurrence.toString(),
          );
        }
        // Detached exceptions may move an occurrence into the visible date range.
        for (const exception of exceptions)
          if (!cancelled(exception))
            append(
              exception,
              exception.startDate,
              exception.endDate,
              exception.recurrenceId?.toString(),
            );
      } else append(master, master.startDate, master.endDate);
    }
  } catch (error) {
    if (/^The calendar |^Calendar |^This calendar /.test(error.message))
      throw error;
    throw new Error(
      "The calendar contains an unsupported or invalid event. Try exporting a smaller, recent .ics file.",
    );
  }
  events.sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
  return {
    name: String(
      calendar.getFirstPropertyValue("x-wr-calname") ||
        calendar.getFirstPropertyValue("name") ||
        "Subscribed calendar",
    ).slice(0, 200),
    events: events.slice(0, MAX_EVENTS),
  };
}
