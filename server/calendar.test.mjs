import test from "node:test";
import assert from "node:assert/strict";
import { parseCalendar } from "./calendar.mjs";
const now = new Date("2026-10-25T12:00:00Z");
const calendar = (events, extra = "") =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Orbit//Calendar//EN\r\n${extra}\r\n${events}\r\nEND:VCALENDAR`;
const event = (fields) => `BEGIN:VEVENT\r\n${fields}\r\nEND:VEVENT`;

test("ICS parsing preserves all-day dates, folded text, and excludes old events", () => {
  const result = parseCalendar(
    calendar(
      [
        event(
          "UID:all-day\r\nDTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261028\r\nSUMMARY:Build V2 and make\r\n  room for the useful things\r\nLOCATION:Buffalo",
        ),
        event(
          "UID:old\r\nDTSTART:20260101T120000Z\r\nDTEND:20260101T130000Z\r\nSUMMARY:Old",
        ),
      ].join("\r\n"),
      "X-WR-CALNAME:Personal plans",
    ),
    { now },
  );
  assert.equal(result.name, "Personal plans");
  assert.equal(result.events.length, 1);
  assert.deepEqual(
    {
      start: result.events[0].start,
      end: result.events[0].end,
      title: result.events[0].title,
      allDay: result.events[0].allDay,
    },
    {
      start: "2026-10-26",
      end: "2026-10-28",
      title: "Build V2 and make room for the useful things",
      allDay: true,
    },
  );
});

test("recurring events honor EXDATE, moved exceptions, and cancelled occurrences", () => {
  const result = parseCalendar(
    calendar(
      [
        event(
          "UID:repeat\r\nDTSTART:20261025T130000Z\r\nDTEND:20261025T140000Z\r\nSUMMARY:Daily\r\nRRULE:FREQ=DAILY;COUNT=5\r\nEXDATE:20261026T130000Z",
        ),
        event(
          "UID:repeat\r\nRECURRENCE-ID:20261027T130000Z\r\nDTSTART:20261027T160000Z\r\nDTEND:20261027T170000Z\r\nSUMMARY:Moved",
        ),
        event(
          "UID:repeat\r\nRECURRENCE-ID:20261028T130000Z\r\nSTATUS:CANCELLED",
        ),
      ].join("\r\n"),
    ),
    { now },
  );
  assert.equal(result.events.length, 3);
  assert.deepEqual(
    result.events.map((e) => [e.title, e.start]),
    [
      ["Daily", "2026-10-25T13:00:00.000Z"],
      ["Moved", "2026-10-27T16:00:00.000Z"],
      ["Daily", "2026-10-29T13:00:00.000Z"],
    ],
  );
});

test("IANA TZID without VTIMEZONE observes New York daylight saving change", () => {
  const result = parseCalendar(
    calendar(
      event(
        "UID:dst\r\nDTSTART;TZID=America/New_York:20261031T090000\r\nDTEND;TZID=America/New_York:20261031T100000\r\nSUMMARY:Morning\r\nRRULE:FREQ=DAILY;COUNT=3",
      ),
    ),
    { now },
  );
  assert.deepEqual(
    result.events.map((e) => e.start),
    [
      "2026-10-31T13:00:00.000Z",
      "2026-11-01T14:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
    ],
  );
});

test("embedded VTIMEZONE is used without changing global timezone definitions", () => {
  const zone =
    "BEGIN:VTIMEZONE\r\nTZID:Custom/Fixed\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0530\r\nTZOFFSETTO:+0530\r\nEND:STANDARD\r\nEND:VTIMEZONE";
  const result = parseCalendar(
    calendar(
      `${zone}\r\n${event("UID:zone\r\nDTSTART;TZID=Custom/Fixed:20261025T090000\r\nDTEND;TZID=Custom/Fixed:20261025T100000\r\nSUMMARY:Custom time")}`,
    ),
    { now },
  );
  assert.equal(result.events[0].start, "2026-10-25T03:30:00.000Z");
});

test("unsupported content, excessive files, and dangerous event links are handled safely", () => {
  assert.throws(() => parseCalendar("not a calendar"), /not a valid ICS/);
  assert.throws(
    () => parseCalendar("x".repeat(2 * 1024 * 1024 + 1)),
    /no larger than 2 MB/,
  );
  const result = parseCalendar(
    calendar(
      event(
        "UID:links\r\nDTSTART:20261025T130000Z\r\nURL:javascript:alert(1)\r\nDESCRIPTION:Join https://meet.google.com/abc-defg-hij",
      ),
    ),
    { now },
  );
  assert.equal(result.events[0].url, undefined);
  assert.equal(
    result.events[0].meetingUrl,
    "https://meet.google.com/abc-defg-hij",
  );
});

test("unbounded high-frequency recurrence cannot consume millions of iterations", () => {
  assert.throws(
    () =>
      parseCalendar(
        calendar(
          event(
            "UID:huge\r\nDTSTART:20000101T000000Z\r\nRRULE:FREQ=SECONDLY\r\nSUMMARY:Unbounded",
          ),
        ),
        { now },
      ),
    /too large to expand safely/,
  );
});
