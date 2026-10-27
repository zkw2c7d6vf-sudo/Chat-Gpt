import { useState } from "react";
import {
  BookOpen,
  Check,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { newId } from "./id";
import { localDay } from "./local";
import type { EducationRecord } from "./education";
import { validEducationRecord } from "./education";
import "./modules.css";
import { useDialogFocus } from "./useDialogFocus";

export default function EducationCenter({
  records,
  onChange,
}: {
  records: EducationRecord[];
  onChange: (records: EducationRecord[]) => boolean;
}) {
  const [filter, setFilter] = useState("open"),
    [query, setQuery] = useState("");
  const [draft, setDraft] = useState<EducationRecord | null>(null),
    [error, setError] = useState("");
  const [removed, setRemoved] = useState<EducationRecord | null>(null);
  const dialogRef = useDialogFocus(Boolean(draft), () => setDraft(null));
  const day = localDay();
  const visible = records
    .filter(
      (record) =>
        (filter === "all" ||
          (filter === "open"
            ? record.status !== "done"
            : filter === "done"
              ? record.status === "done"
              : record.domain === filter)) &&
        `${record.title} ${record.course} ${record.notes}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );
  const start = () => {
    setError("");
    setDraft({
      id: newId(),
      title: "",
      course: "",
      domain: "college",
      kind: "assignment",
      dueDate: "",
      status: "planned",
      notes: "",
      url: "",
      createdAt: new Date().toISOString(),
    });
  };
  return (
    <section
      className="education-center module-surface"
      aria-label="Education Center"
    >
      <header className="module-header">
        <div>
          <span className="eyebrow">COLLEGE & TEACHING</span>
          <h2>
            <GraduationCap size={24} />
            Education Center
          </h2>
          <p>
            Assignments, lessons, exams, and course notes in one local
            workspace.
          </p>
        </div>
        <button className="primary-button" onClick={start}>
          <Plus size={16} />
          Add responsibility
        </button>
      </header>
      <div className="module-stats">
        <div>
          <strong>{records.filter((r) => r.status !== "done").length}</strong>
          <span>Open</span>
        </div>
        <div>
          <strong>
            {
              records.filter(
                (r) => r.status !== "done" && r.dueDate && r.dueDate < day,
              ).length
            }
          </strong>
          <span>Overdue</span>
        </div>
        <div>
          <strong>
            {
              records.filter((r) => r.status !== "done" && r.dueDate === day)
                .length
            }
          </strong>
          <span>Due today</span>
        </div>
        <div>
          <strong>{records.filter((r) => r.status === "done").length}</strong>
          <span>Completed</span>
        </div>
      </div>
      <div className="module-filters">
        <input
          aria-label="Search education"
          placeholder="Search responsibilities or courses"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter education"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="open">Open</option>
          <option value="all">All responsibilities</option>
          <option value="college">College</option>
          <option value="teaching">Teaching</option>
          <option value="done">Completed</option>
        </select>
      </div>
      {!visible.length ? (
        <div className="module-empty">
          <BookOpen size={32} />
          <h3>
            {records.length
              ? "No matching responsibilities"
              : "Your courses start here"}
          </h3>
          <p>
            {records.length
              ? "Change the filter or search."
              : "Add a responsibility. Dated items appear in Home and Planner automatically."}
          </p>
          {!records.length && (
            <button className="primary-button" onClick={start}>
              Add your first responsibility
            </button>
          )}
        </div>
      ) : (
        <div className="education-grid">
          {visible.map((record) => (
            <article
              className={`education-record ${record.status === "done" ? "completed" : ""}`}
              key={record.id}
            >
              <div className="education-tags">
                <span>{record.domain}</span>
                <span>{record.kind}</span>
                <span className={record.status}>
                  {record.status === "active" ? "In progress" : record.status}
                </span>
              </div>
              <h3>{record.title}</h3>
              {record.course && (
                <p className="education-course">{record.course}</p>
              )}
              {record.dueDate && (
                <time
                  className={
                    record.status !== "done" && record.dueDate < day
                      ? "overdue"
                      : ""
                  }
                  dateTime={record.dueDate}
                >
                  {record.dueDate < day && record.status !== "done"
                    ? "Overdue · "
                    : "Due "}
                  {new Date(`${record.dueDate}T12:00:00`).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" },
                  )}
                </time>
              )}
              {record.notes && (
                <p className="education-notes">{record.notes}</p>
              )}
              <div className="education-actions">
                <button
                  aria-label={`${record.status === "done" ? "Reopen" : "Complete"} education ${record.title}`}
                  onClick={() =>
                    onChange(
                      records.map((item) =>
                        item.id === record.id
                          ? {
                              ...item,
                              status:
                                record.status === "done" ? "planned" : "done",
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <Check size={14} />
                  {record.status === "done" ? "Reopen" : "Complete"}
                </button>
                <button
                  aria-label={`Edit education ${record.title}`}
                  onClick={() => {
                    setDraft({ ...record });
                    setError("");
                  }}
                >
                  <Pencil size={14} />
                  Edit
                </button>
                {record.url && (
                  <a href={record.url} target="_blank" rel="noreferrer">
                    Resource <ExternalLink size={13} />
                  </a>
                )}
                <button
                  aria-label={`Delete education ${record.title}`}
                  onClick={() => {
                    if (
                      onChange(records.filter((item) => item.id !== record.id))
                    )
                      setRemoved(record);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {removed && (
        <div className="module-notice" role="status">
          Responsibility removed.
          <button
            onClick={() => {
              if (onChange([...records, removed])) setRemoved(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
      <p className="module-privacy">
        Saved in this browser and included in dashboard backups. Education
        records and notes are excluded from AI requests.
      </p>
      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Education responsibility"
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDraft(null);
            }}
          >
            <div className="modal-heading">
              <h2>
                {records.some((record) => record.id === draft.id)
                  ? "Edit responsibility"
                  : "Add responsibility"}
              </h2>
              <button
                aria-label="Close education editor"
                onClick={() => setDraft(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="module-form"
              onSubmit={(event) => {
                event.preventDefault();
                const next = {
                  ...draft,
                  title: draft.title.trim(),
                  course: draft.course.trim(),
                  url: draft.url.trim(),
                };
                if (!validEducationRecord(next)) {
                  setError(
                    "Add a title and a valid date. Resource links must use HTTPS.",
                  );
                  return;
                }
                if (
                  records.length >= 2000 &&
                  !records.some((record) => record.id === next.id)
                ) {
                  setError(
                    "This workspace holds up to 2,000 responsibilities. Export a backup before removing older records.",
                  );
                  return;
                }
                if (
                  onChange(
                    records.some((record) => record.id === next.id)
                      ? records.map((record) =>
                          record.id === next.id ? next : record,
                        )
                      : [next, ...records],
                  )
                )
                  setDraft(null);
                else
                  setError(
                    "Browser storage could not save your responsibility. Your draft is still here.",
                  );
              }}
            >
              <label>
                Title
                <input
                  autoFocus
                  aria-label="Education title"
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label>
                Course / class
                <input
                  aria-label="Education course"
                  maxLength={100}
                  value={draft.course}
                  onChange={(event) =>
                    setDraft({ ...draft, course: event.target.value })
                  }
                />
              </label>
              <div className="module-form-row">
                <label>
                  Area
                  <select
                    aria-label="Education area"
                    value={draft.domain}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        domain: event.target.value as EducationRecord["domain"],
                      })
                    }
                  >
                    <option value="college">College</option>
                    <option value="teaching">Teaching</option>
                  </select>
                </label>
                <label>
                  Type
                  <select
                    aria-label="Education type"
                    value={draft.kind}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        kind: event.target.value as EducationRecord["kind"],
                      })
                    }
                  >
                    {["assignment", "exam", "lesson", "grading", "other"].map(
                      (kind) => (
                        <option key={kind}>{kind}</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="module-form-row">
                <label>
                  Due date
                  <input
                    aria-label="Education due date"
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) =>
                      setDraft({ ...draft, dueDate: event.target.value })
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    aria-label="Education status"
                    value={draft.status}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as EducationRecord["status"],
                      })
                    }
                  >
                    <option value="planned">Planned</option>
                    <option value="active">In progress</option>
                    <option value="done">Completed</option>
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea
                  aria-label="Education notes"
                  rows={4}
                  maxLength={10000}
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                />
              </label>
              <label>
                Resource link (optional)
                <input
                  aria-label="Education resource link"
                  type="url"
                  placeholder="https://"
                  maxLength={2048}
                  value={draft.url}
                  onChange={(event) =>
                    setDraft({ ...draft, url: event.target.value })
                  }
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <button type="submit" className="primary-button">
                Save responsibility
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
