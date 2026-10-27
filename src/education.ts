export type EducationRecord = {
  id: string;
  title: string;
  course: string;
  domain: "college" | "teaching";
  kind: "assignment" | "exam" | "lesson" | "grading" | "other";
  dueDate: string;
  status: "planned" | "active" | "done";
  notes: string;
  url: string;
  createdAt: string;
};
export function validDay(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validEducationRecord(value: unknown): value is EducationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as EducationRecord;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    v.id.length <= 200 &&
    typeof v.title === "string" &&
    v.title.trim().length > 0 &&
    v.title.length <= 200 &&
    typeof v.course === "string" &&
    v.course.length <= 100 &&
    ["college", "teaching"].includes(v.domain) &&
    ["assignment", "exam", "lesson", "grading", "other"].includes(v.kind) &&
    validDay(v.dueDate) &&
    ["planned", "active", "done"].includes(v.status) &&
    typeof v.notes === "string" &&
    v.notes.length <= 10000 &&
    typeof v.url === "string" &&
    v.url.length <= 2048 &&
    (!v.url ||
      (() => {
        try {
          const url = new URL(v.url);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      })()) &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    Object.keys(v).every((key) =>
      [
        "id",
        "title",
        "course",
        "domain",
        "kind",
        "dueDate",
        "status",
        "notes",
        "url",
        "createdAt",
      ].includes(key),
    )
  );
}
export function educationDeadlines(records: EducationRecord[]) {
  return records
    .filter((record) => record.status !== "done" && record.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
