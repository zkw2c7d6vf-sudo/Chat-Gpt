export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const BACKUP_KEYS = [
  "orbit-tasks",
  "orbit-notes",
  "orbit-read",
  "orbit-messages",
  "orbit-demo",
  "orbit-track-steps",
  "orbit-spoken-replies",
  "orbit-seed-v2",
  "orbit-weather-location",
  "orbit-weather-unit",
  "orbit-command-v3",
  "orbit-pending-v3",
  "orbit-activity-v3",
  "orbit-priorities-v3",
  "orbit-seed-v3",
] as const;
export type BackupKey = (typeof BACKUP_KEYS)[number];
export type DashboardBackup = {
  format: "orbit-dashboard-backup";
  version: "1";
  createdAt: string;
  data: Partial<Record<BackupKey, unknown>>;
};
export type BackupStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type BackupPreview = {
  taskCount: number;
  messageCount: number;
  hasNotes: boolean;
  weatherLocation: string | null;
  settingsCount: number;
  entryCount: number;
  proposalCount: number;
};
const booleanKeys = new Set<string>([
  "orbit-demo",
  "orbit-track-steps",
  "orbit-spoken-replies",
  "orbit-seed-v2",
  "orbit-seed-v3",
]);
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number, empty = true): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (empty || value.trim().length > 0)
  );
}
function stringArray(value: unknown, count: number, length: number) {
  return (
    Array.isArray(value) &&
    value.length <= count &&
    value.every((item) => text(item, length, false))
  );
}
function timestamp(value: unknown): value is string {
  return (
    text(value, 40, false) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function day(value: unknown): boolean {
  if (value === "") return true;
  if (!text(value, 10, false) || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
function uniqueRecords(
  value: unknown,
  max: number,
  validator: (item: Record<string, unknown>) => boolean,
) {
  if (!Array.isArray(value) || value.length > max) return false;
  const ids = new Set();
  return value.every((item) => {
    if (
      !object(item) ||
      !text(item.id, 200, false) ||
      ids.has(item.id) ||
      !validator(item)
    )
      return false;
    ids.add(item.id);
    return true;
  });
}
function validValue(key: BackupKey, value: unknown): boolean {
  if (booleanKeys.has(key)) return typeof value === "boolean";
  if (key === "orbit-priorities-v3") return stringArray(value, 100, 200);
  if (key === "orbit-command-v3")
    return uniqueRecords(
      value,
      2000,
      (item) =>
        text(item.title, 500, false) &&
        [
          "task",
          "school",
          "teaching",
          "finance",
          "habit",
          "note",
          "idea",
          "reminder",
        ].includes(String(item.domain)) &&
        day(item.due) &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount >= 0 &&
        item.amount <= 1e15 &&
        typeof item.target === "number" &&
        Number.isFinite(item.target) &&
        item.target >= 0 &&
        item.target <= 1e15 &&
        typeof item.completed === "boolean" &&
        timestamp(item.createdAt) &&
        (item.lastDone === undefined || day(item.lastDone)) &&
        Object.keys(item).every((field) =>
          [
            "id",
            "title",
            "domain",
            "due",
            "amount",
            "target",
            "completed",
            "createdAt",
            "lastDone",
          ].includes(field),
        ),
    );
  if (key === "orbit-pending-v3")
    return uniqueRecords(
      value,
      100,
      (item) =>
        text(item.title, 500, false) &&
        timestamp(item.createdAt) &&
        Object.keys(item).every((field) =>
          ["id", "title", "createdAt"].includes(field),
        ),
    );
  if (key === "orbit-activity-v3")
    return uniqueRecords(
      value,
      200,
      (item) =>
        text(item.title, 500, false) &&
        text(item.status, 100, false) &&
        timestamp(item.createdAt) &&
        Object.keys(item).every((field) =>
          ["id", "title", "status", "createdAt"].includes(field),
        ),
    );
  if (key === "orbit-notes") return text(value, 500_000);
  if (key === "orbit-read") return stringArray(value, 10_000, 200);
  if (key === "orbit-weather-unit")
    return value === "fahrenheit" || value === "celsius";
  if (key === "orbit-tasks") {
    if (!Array.isArray(value) || value.length > 2000) return false;
    const ids = new Set();
    return value.every((item) => {
      if (
        !object(item) ||
        !text(item.id, 200, false) ||
        !text(item.title, 500, false) ||
        typeof item.done !== "boolean"
      )
        return false;
      if (
        item.source !== undefined &&
        !["build", "assistant", "you"].includes(String(item.source))
      )
        return false;
      if (
        Object.keys(item).some(
          (field) => !["id", "title", "done", "source"].includes(field),
        )
      )
        return false;
      if (ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    });
  }
  if (key === "orbit-messages") {
    return (
      Array.isArray(value) &&
      value.length <= 200 &&
      value.every(
        (item) =>
          object(item) &&
          (item.role === "user" || item.role === "assistant") &&
          text(item.content, 20_000) &&
          Object.keys(item).every((field) =>
            ["role", "content"].includes(field),
          ),
      )
    );
  }
  if (key === "orbit-weather-location") {
    if (
      !object(value) ||
      !text(value.name, 120, false) ||
      typeof value.latitude !== "number" ||
      !Number.isFinite(value.latitude) ||
      Math.abs(value.latitude) > 90 ||
      typeof value.longitude !== "number" ||
      !Number.isFinite(value.longitude) ||
      Math.abs(value.longitude) > 180
    )
      return false;
    if (
      Object.keys(value).some(
        (field) =>
          ![
            "name",
            "latitude",
            "longitude",
            "country",
            "region",
            "timezone",
          ].includes(field),
      )
    )
      return false;
    return ["country", "region", "timezone"].every(
      (field) => value[field] === undefined || text(value[field], 120),
    );
  }
  return false;
}
function validate(value: unknown): asserts value is DashboardBackup {
  if (
    !object(value) ||
    value.format !== "orbit-dashboard-backup" ||
    value.version !== "1"
  )
    throw new Error(
      "Choose an Orbit dashboard backup with version 1. Other files cannot be restored.",
    );
  if (
    !text(value.createdAt, 40, false) ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    throw new Error("This backup has an invalid creation date.");
  if (
    Object.keys(value).some(
      (key) => !["format", "version", "createdAt", "data"].includes(key),
    )
  )
    throw new Error("This backup contains unsupported fields.");
  if (!object(value.data) || Object.keys(value.data).length === 0)
    throw new Error("This backup contains no dashboard data to restore.");
  for (const [key, item] of Object.entries(value.data)) {
    if (!(BACKUP_KEYS as readonly string[]).includes(key))
      throw new Error(
        "This backup contains unsupported data. Account credentials, delivery links, and media files cannot be imported here.",
      );
    if (!validValue(key as BackupKey, item))
      throw new Error(
        `The backup's ${key.replace("orbit-", "").replaceAll("-", " ")} data is invalid. Nothing was restored.`,
      );
  }
}
export function parseBackup(contents: string): DashboardBackup {
  if (new TextEncoder().encode(contents).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Choose an Orbit backup smaller than 2 MiB.");
  let data: unknown;
  try {
    data = JSON.parse(contents);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose a dashboard backup exported by Orbit.",
    );
  }
  validate(data);
  return data;
}
export function createBackup(
  storage: BackupStorage,
  now = new Date(),
): DashboardBackup {
  const data: DashboardBackup["data"] = {};
  for (const key of BACKUP_KEYS) {
    const stored = storage.getItem(key);
    if (stored === null) continue;
    try {
      data[key] = key === "orbit-weather-unit" ? stored : JSON.parse(stored);
    } catch {
      throw new Error(
        `Your saved ${key.replace("orbit-", "").replaceAll("-", " ")} data could not be read. Other browser data has not been changed.`,
      );
    }
  }
  if (!Object.keys(data).length)
    throw new Error("There is no saved dashboard data in this browser yet.");
  const backup: DashboardBackup = {
    format: "orbit-dashboard-backup",
    version: "1",
    createdAt: now.toISOString(),
    data,
  };
  // Export is held to the same limits as import, so every valid export can be restored.
  return parseBackup(JSON.stringify(backup));
}
export function previewBackup(backup: DashboardBackup): BackupPreview {
  validate(backup);
  return {
    taskCount: Array.isArray(backup.data["orbit-tasks"])
      ? backup.data["orbit-tasks"].length
      : 0,
    messageCount: Array.isArray(backup.data["orbit-messages"])
      ? backup.data["orbit-messages"].length
      : 0,
    hasNotes:
      typeof backup.data["orbit-notes"] === "string" &&
      backup.data["orbit-notes"].length > 0,
    weatherLocation: object(backup.data["orbit-weather-location"])
      ? String(backup.data["orbit-weather-location"].name)
      : null,
    settingsCount: Object.keys(backup.data).length,
    entryCount: Array.isArray(backup.data["orbit-command-v3"])
      ? backup.data["orbit-command-v3"].length
      : 0,
    proposalCount: Array.isArray(backup.data["orbit-pending-v3"])
      ? backup.data["orbit-pending-v3"].length
      : 0,
  };
}
export function applyBackup(backup: DashboardBackup, storage: BackupStorage) {
  validate(backup);
  const entries = Object.entries(backup.data) as [BackupKey, unknown][];
  const previous = new Map(entries.map(([key]) => [key, storage.getItem(key)]));
  const attempted: BackupKey[] = [];
  try {
    for (const [key, value] of entries) {
      attempted.push(key);
      storage.setItem(
        key,
        key === "orbit-weather-unit" ? String(value) : JSON.stringify(value),
      );
    }
  } catch {
    let rollbackFailed = false;
    for (const key of attempted.reverse()) {
      try {
        const old = previous.get(key);
        if (old === null || old === undefined) storage.removeItem(key);
        else storage.setItem(key, old);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(
      rollbackFailed
        ? "Browser storage refused the restore and part of the rollback. Keep this page open and export your current data before trying again."
        : "Browser storage could not save this backup. Your previous dashboard data was restored. Try freeing browser storage and retry.",
    );
  }
}
