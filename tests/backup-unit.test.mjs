import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackup,
  parseBackup,
  previewBackup,
  applyBackup,
  MAX_BACKUP_BYTES,
} from "../src/backup.ts";
class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
    this.failOnce = null;
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (key === this.failOnce) {
      this.failOnce = null;
      throw new Error("simulated quota");
    }
    this.values.set(key, value);
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
const when = "2026-10-25T12:00:00.000Z";
const wrapped = (data) =>
  JSON.stringify({
    format: "orbit-dashboard-backup",
    version: "1",
    createdAt: when,
    data,
  });
test("backup exports only approved dashboard text and never account, media, or delivery storage", () => {
  const storage = new MemoryStorage({
    "orbit-tasks": JSON.stringify([
      { id: "t1", title: "A task", done: false, source: "you" },
    ]),
    "orbit-weather-unit": "fahrenheit",
    "orbit-weather-location": JSON.stringify({
      name: "Buffalo",
      latitude: 42.8864,
      longitude: -78.8784,
    }),
    "orbit-delivery-v3": "private delivery",
    "orbit-shopping-searches-v1": JSON.stringify([
      { id: "search1", query: "navy sneakers" },
    ]),
    "secret-token": "secret",
    "orbit-media": "media metadata",
  });
  const backup = createBackup(storage, new Date(when));
  assert.deepEqual(Object.keys(backup.data), [
    "orbit-tasks",
    "orbit-weather-location",
    "orbit-weather-unit",
    "orbit-shopping-searches-v1",
  ]);
  assert.equal(JSON.stringify(backup).includes("private delivery"), false);
  assert.equal(JSON.stringify(backup).includes("secret"), false);
  assert.equal(previewBackup(backup).taskCount, 1);
  assert.equal(previewBackup(backup).weatherLocation, "Buffalo");
});
test("V3 life command entries, pending approvals, priorities and activity round trip", () => {
  const data = {
    "orbit-command-v3": [
      {
        id: "c1",
        title: "Prepare lesson",
        domain: "teaching",
        due: "2026-10-29",
        amount: 0,
        target: 0,
        completed: false,
        createdAt: when,
      },
      {
        id: "c2",
        title: "Build savings",
        domain: "finance",
        due: "",
        amount: 50,
        target: 1000,
        completed: false,
        createdAt: when,
      },
      {
        id: "c3",
        title: "Stretch",
        domain: "habit",
        due: "",
        amount: 0,
        target: 0,
        completed: false,
        createdAt: when,
        lastDone: "2026-10-25",
      },
    ],
    "orbit-pending-v3": [
      { id: "p1", title: "Consider an action", createdAt: when },
    ],
    "orbit-activity-v3": [
      {
        id: "a1",
        title: "Capture lesson plan",
        status: "Captured",
        createdAt: when,
      },
    ],
    "orbit-priorities-v3": ["c1"],
    "orbit-seed-v3": true,
  };
  const backup = parseBackup(wrapped(data));
  const storage = new MemoryStorage();
  applyBackup(backup, storage);
  assert.deepEqual(createBackup(storage, new Date(when)).data, data);
  assert.equal(previewBackup(backup).entryCount, 3);
  assert.equal(previewBackup(backup).proposalCount, 1);
});
test("restore replaces only included keys and preserves browser sessions and other dashboard sections", () => {
  const storage = new MemoryStorage({
    "orbit-notes": JSON.stringify("old note"),
    "orbit-tasks": "[]",
    "orbit-delivery-v3": "leave private link",
    other: "leave alone",
  });
  applyBackup(
    parseBackup(
      wrapped({ "orbit-notes": "new note", "orbit-weather-unit": "celsius" }),
    ),
    storage,
  );
  assert.equal(storage.getItem("orbit-notes"), JSON.stringify("new note"));
  assert.equal(storage.getItem("orbit-tasks"), "[]");
  assert.equal(storage.getItem("orbit-weather-unit"), "celsius");
  assert.equal(storage.getItem("orbit-delivery-v3"), "leave private link");
  assert.equal(storage.getItem("other"), "leave alone");
});
test("storage failure restores previous values and removes newly introduced keys", () => {
  const storage = new MemoryStorage({
    "orbit-notes": JSON.stringify("original note"),
    "orbit-tasks": "[]",
  });
  storage.failOnce = "orbit-tasks";
  const before = new Map(storage.values);
  assert.throws(
    () =>
      applyBackup(
        parseBackup(
          wrapped({
            "orbit-notes": "changed note",
            "orbit-weather-unit": "celsius",
            "orbit-tasks": [{ id: "new", title: "New task", done: false }],
          }),
        ),
        storage,
      ),
    /previous dashboard data was restored/,
  );
  assert.deepEqual(storage.values, before);
});
test("invalid credentials, prototype keys, task values and malformed life entries are rejected before writes", () => {
  const cases = [
    { SPOTIFY_CLIENT_SECRET: "not allowed" },
    { __proto__: "unexpected" },
    { "orbit-tasks": [{ id: "x", title: "x", done: "false" }] },
    {
      "orbit-tasks": [
        { id: "same", title: "x", done: false },
        { id: "same", title: "y", done: true },
      ],
    },
    {
      "orbit-weather-location": { name: "wrong", latitude: 999, longitude: 0 },
    },
    {
      "orbit-command-v3": [
        {
          id: "x",
          title: "x",
          domain: "finance",
          due: "2026-02-30",
          amount: 0,
          target: 1,
          completed: false,
          createdAt: when,
        },
      ],
    },
    {
      "orbit-pending-v3": [
        { id: "x", title: "x", createdAt: when, execute: "untrusted" },
      ],
    },
  ];
  for (const item of cases) assert.throws(() => parseBackup(wrapped(item)));
  assert.throws(
    () =>
      parseBackup(
        '{"format":"orbit-dashboard-backup","version":"1","createdAt":"' +
          when +
          '","data":{"__proto__":{}}}',
      ),
    /unsupported data/,
  );
});
test("backup validates version, date, JSON and byte size", () => {
  assert.throws(() => parseBackup("not json"), /not valid JSON/);
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          format: "orbit-dashboard-backup",
          version: "99",
          createdAt: when,
          data: { "orbit-notes": "x" },
        }),
      ),
    /version 1/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          format: "orbit-dashboard-backup",
          version: "1",
          createdAt: "not a date",
          data: { "orbit-notes": "x" },
        }),
      ),
    /creation date/,
  );
  assert.throws(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /2 MiB/);
});
