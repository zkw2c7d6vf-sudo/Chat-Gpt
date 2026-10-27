import test from "node:test";
import assert from "node:assert/strict";
import { convertText, parseCsv, jsonToCsv } from "../src/fileTools.ts";
import {
  validEducationRecord,
  educationDeadlines,
  validDay,
} from "../src/education.ts";
import {
  createBackup,
  parseBackup,
  applyBackup,
  previewBackup,
} from "../src/backup.ts";
import { focusSeconds, validFocusSettings } from "../src/focus.ts";
import { upcomingEvents } from "../src/data.ts";
const record = {
  id: "e1",
  title: "Prepare seminar",
  course: "History",
  domain: "teaching",
  kind: "lesson",
  dueDate: "2026-10-29",
  status: "active",
  notes: "Private teaching notes",
  url: "https://example.org/course",
  createdAt: "2026-10-27T12:00:00.000Z",
};
test("education validates real dates, safe resource links, fields, and private record shape", () => {
  assert(validEducationRecord(record));
  assert(!validDay("2026-02-30"));
  assert(validDay("2028-02-29"));
  for (const patch of [
    { dueDate: "yesterday" },
    { title: " " },
    { status: "unknown" },
    { url: "javascript:alert(1)" },
    { url: "https://user:pass@example.org" },
    { notes: "x".repeat(10001) },
    { unexpected: true },
  ])
    assert(!validEducationRecord({ ...record, ...patch }));
});
test("education deadline selector omits completed and undated records without duplicating them", () => {
  const early = { ...record, id: "early", dueDate: "2026-10-28" };
  assert.deepEqual(
    educationDeadlines([
      record,
      { ...record, id: "done", status: "done" },
      { ...record, id: "none", dueDate: "" },
      early,
    ]).map((item) => item.id),
    ["early", "e1"],
  );
});
test("CSV conversion round-trips quoted commas, escaped quotes, Unicode, and embedded newlines", () => {
  const values = [
    { name: 'Doe, "Jo"', note: "Line one\nLine two", course: "中文" },
    { name: "A", note: "", course: "History" },
  ];
  assert.deepEqual(parseCsv(jsonToCsv(JSON.stringify(values))), values);
  assert.deepEqual(parseCsv("\uFEFFa,b\r\n1,2\r\n"), [{ a: "1", b: "2" }]);
  assert.deepEqual(parseCsv('a,b\n"",""'), [{ a: "", b: "" }]);
});
test("malformed or ambiguous CSV fails with useful errors instead of losing columns", () => {
  for (const invalid of [
    "a,a\n1,2",
    "a,\n1,2",
    "a,b\n1",
    'a\n"unclosed',
    'a\n"value"trailing',
  ])
    assert.throws(() => parseCsv(invalid));
  assert.throws(() => jsonToCsv("[1,2]"), /array of objects/);
  assert.throws(() => jsonToCsv("[{}]"), /at least one field/);
});
test("text conversions preserve values and reject oversized or invalid JSON", () => {
  const formatted = convertText('{"a":1}', "format-json");
  assert.match(formatted.text, /\n/);
  assert.equal(convertText(formatted.text, "minify-json").text, '{"a":1}');
  assert.throws(() => convertText("nope", "format-json"));
  assert.throws(
    () => convertText("x".repeat(2 * 1024 * 1024 + 1), "csv-json"),
    /2 MiB/,
  );
});
test("focus deadlines keep elapsed time across reload, pause and clock catch-up", () => {
  const session = {
    id: "session",
    minutes: 25,
    remaining: 1500,
    deadline: 100000,
    label: "Study",
  };
  assert.equal(focusSeconds(session, 40000), 60);
  assert.equal(focusSeconds(session, 100001), 0);
  assert.equal(
    focusSeconds({ ...session, deadline: null, remaining: 720 }, 999999),
    720,
  );
  assert(
    validFocusSettings({
      minutes: 7,
      sound: "rain",
      volume: 35,
      label: "Study",
    }),
  );
  assert(
    !validFocusSettings({
      minutes: 0,
      sound: "rain",
      volume: 35,
      label: "Study",
    }),
  );
  assert(
    !validFocusSettings({
      minutes: 25,
      sound: "invented",
      volume: 35,
      label: "Study",
    }),
  );
});
test("4.5 education, focus settings/history and saved YouTube IDs back up and restore, active timers stay private to the browser", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  const data = {
    "orbit-education-v1": [record],
    "orbit-focus-settings-v45": {
      minutes: 25,
      sound: "rain",
      volume: 35,
      label: "Seminar",
    },
    "orbit-focus-history-v45": [
      {
        id: "s1",
        minutes: 25,
        label: "Seminar",
        completedAt: record.createdAt,
      },
    ],
    "orbit-youtube-watchlist-v1": ["abcdefghijk"],
  };
  for (const [key, value] of Object.entries(data))
    storage.setItem(key, JSON.stringify(value));
  storage.setItem("orbit-focus-session-v45", JSON.stringify({ deadline: 123 }));
  const backup = createBackup(storage);
  assert.deepEqual(backup.data, data);
  map.clear();
  applyBackup(parseBackup(JSON.stringify(backup)), storage);
  assert.deepEqual(createBackup(storage).data, data);
  assert.equal(previewBackup(backup).educationCount, 1);
  assert.equal(previewBackup(backup).focusCount, 1);
  assert.equal(storage.getItem("orbit-focus-session-v45"), null);
});
test("backup rejects duplicate education identities, unsafe sources and impossible focus history before writes", () => {
  const wrap = (data) =>
    JSON.stringify({
      format: "orbit-dashboard-backup",
      version: "1",
      createdAt: record.createdAt,
      data,
    });
  for (const data of [
    { "orbit-education-v1": [record, record] },
    { "orbit-education-v1": [{ ...record, url: "http://example.org" }] },
    {
      "orbit-focus-history-v45": [
        { id: "s", minutes: -1, label: "", completedAt: record.createdAt },
      ],
    },
    { "orbit-youtube-watchlist-v1": ["not valid"] },
  ])
    assert.throws(() => parseBackup(wrap(data)));
});
test("shopping backups accept saved offers without an optional image", () => {
  const data = {
    "orbit-shopping-offers-v1": [
      {
        id: "o",
        searchId: "s",
        store: "Target",
        url: "",
        image: "",
        price: 20,
        shipping: 0,
        note: "",
      },
    ],
  };
  assert.doesNotThrow(() =>
    parseBackup(
      JSON.stringify({
        format: "orbit-dashboard-backup",
        version: "1",
        createdAt: record.createdAt,
        data,
      }),
    ),
  );
});
test("Up Next respects exclusive all-day end dates and excludes elapsed meetings", () => {
  const now = new Date(2026, 9, 27, 9).getTime();
  const event = { title: "Fixture", location: "", allDay: true };
  const list = [
    { ...event, id: "yesterday", start: "2026-10-26", end: "2026-10-27" },
    { ...event, id: "today", start: "2026-10-27", end: "2026-10-28" },
    { ...event, id: "tomorrow", start: "2026-10-28", end: "2026-10-29" },
    {
      ...event,
      id: "past-meeting",
      allDay: false,
      start: new Date(now - 7200000).toISOString(),
      end: new Date(now - 3600000).toISOString(),
    },
  ];
  assert.deepEqual(
    upcomingEvents(list, now).map((item) => item.id),
    ["today", "tomorrow"],
  );
});
