import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Check,
  Star,
  GraduationCap,
  Target,
  Heart,
  Inbox,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import type { Task } from "./data";
import "./command.css";
export type Proposal = { id: string; title: string; createdAt: string };
type Entry = {
  id: string;
  title: string;
  domain: string;
  due: string;
  amount: number;
  target: number;
  completed: boolean;
  createdAt: string;
  lastDone?: string;
};
type Activity = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("orbit:command"));
}
function activity(title: string, status: string) {
  const list = read<Activity[]>("orbit-activity-v3", []);
  save(
    "orbit-activity-v3",
    [
      {
        id: crypto.randomUUID(),
        title,
        status,
        createdAt: new Date().toISOString(),
      },
      ...list,
    ].slice(0, 50),
  );
}
export function proposeTasks(titles: string[]) {
  const list = read<Proposal[]>("orbit-pending-v3", []);
  const known = new Set(list.map((x) => x.title.toLowerCase()));
  for (const title of titles.slice(0, 3)) {
    const clean = title.trim().slice(0, 200);
    if (clean && !known.has(clean.toLowerCase())) {
      list.push({
        id: crypto.randomUUID(),
        title: clean,
        createdAt: new Date().toISOString(),
      });
      known.add(clean.toLowerCase());
    }
  }
  save("orbit-pending-v3", list.slice(-30));
}
export function QuickCapture({
  onTask,
  onNote,
}: {
  onTask: (title: string) => void;
  onNote: (text: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [domain, setDomain] = useState("task"),
    [due, setDue] = useState(""),
    [target, setTarget] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const show = () => setOpen(true);
    const key = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("orbit:quickcapture", show);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("orbit:quickcapture", show);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const node = document.getElementById("capture-dialog");
    node?.querySelector<HTMLInputElement>("input")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = node?.querySelectorAll<HTMLElement>("input,select,button");
      if (!els?.length) return;
      const first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [open]);
  return open ? (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <section
        id="capture-dialog"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <div className="eyebrow">GET IT OUT OF YOUR HEAD</div>
            <h2>Quick capture</h2>
          </div>
          <button
            aria-label="Close quick capture"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <form
          className="capture-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            try {
              const entry: Entry = {
                id: crypto.randomUUID(),
                title: title.trim(),
                domain,
                due,
                amount: 0,
                target: Number.isFinite(Number(target))
                  ? Math.max(0, Number(target))
                  : 0,
                completed: false,
                createdAt: new Date().toISOString(),
              };
              if (domain === "task") onTask(entry.title);
              else if (domain === "note" || domain === "idea")
                onNote(entry.title);
              if (domain !== "task") {
                save("orbit-command-v3", [
                  entry,
                  ...read<Entry[]>("orbit-command-v3", []),
                ]);
              }
              activity(entry.title, "Captured");
              setTitle("");
              setDue("");
              setTarget("");
              setOpen(false);
              setError("");
            } catch {
              setError(
                "Storage is full or unavailable. Your draft is still here.",
              );
            }
          }}
        >
          <label>
            What’s on your mind?
            <input
              aria-label="Capture title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Title"
            />
          </label>
          <label>
            Save as
            <select
              aria-label="Capture type"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              <option value="task">Task</option>
              <option value="school">College responsibility</option>
              <option value="teaching">Teaching responsibility</option>
              <option value="finance">Financial / income goal</option>
              <option value="habit">Habit</option>
              <option value="note">Note</option>
              <option value="idea">Idea</option>
              <option value="reminder">Reminder</option>
            </select>
          </label>
          {["school", "teaching", "reminder"].includes(domain) && (
            <label>
              Due date (optional)
              <input
                aria-label="Capture due date"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          )}
          {domain === "finance" && (
            <label>
              Target amount (USD)
              <input
                aria-label="Goal target amount"
                type="number"
                min="1"
                step="0.01"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
              />
            </label>
          )}
          <p>
            Saved locally. Reminders appear in Orbit; they don’t send system
            notifications.
          </p>
          {error && <p role="alert">{error}</p>}
          <button className="primary-button" type="submit">
            <Plus size={15} />
            Capture it
          </button>
        </form>
      </section>
    </div>
  ) : null;
}
export default function CommandCenter({
  tasks,
  onAddTask,
}: {
  tasks: Task[];
  onAddTask: (title: string) => void;
}) {
  const [entries, setEntries] = useState(() =>
      read<Entry[]>("orbit-command-v3", []),
    ),
    [pending, setPending] = useState(() =>
      read<Proposal[]>("orbit-pending-v3", []),
    ),
    [log, setLog] = useState(() => read<Activity[]>("orbit-activity-v3", [])),
    [pins, setPins] = useState(() => read<string[]>("orbit-priorities-v3", []));
  useEffect(() => {
    const refresh = () => {
      setEntries(read("orbit-command-v3", []));
      setPending(read("orbit-pending-v3", []));
      setLog(read("orbit-activity-v3", []));
    };
    window.addEventListener("orbit:command", refresh);
    return () => window.removeEventListener("orbit:command", refresh);
  }, []);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const day = new Date(clock).toLocaleDateString("en-CA");
  const responsibilities = entries
    .filter(
      (e) =>
        ["school", "teaching", "reminder"].includes(e.domain) && !e.completed,
    )
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const candidates = [
    ...responsibilities.map((e) => ({ id: e.id, title: e.title, due: e.due })),
    ...tasks
      .filter((t) => !t.done)
      .map((t) => ({ id: t.id, title: t.title, due: "" })),
  ];
  const priorities = [...candidates]
    .sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)))
    .slice(0, 3);
  const update = (id: string, patch: Partial<Entry>) =>
    save(
      "orbit-command-v3",
      entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  const capture = () => window.dispatchEvent(new Event("orbit:quickcapture"));
  return (
    <section className="command-center">
      <div className="command-section-heading">
        <div>
          <span className="eyebrow">PERSONAL</span>
          <h2>Plans & progress</h2>
          <p></p>
        </div>
        <button className="primary-button" onClick={capture}>
          <Plus size={15} />
          Quick capture
        </button>
      </div>
      <div className="command-grid">
        <section className="card command-card">
          <h3>
            <Star size={16} />
            Priorities
          </h3>
          <p className="command-caption">
            Pinned items first, then deadlines and open tasks.
          </p>
          <select
            className="priority-picker"
            aria-label="Pin another priority"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const next = [
                e.target.value,
                ...pins.filter((id) => id !== e.target.value),
              ].slice(0, 3);
              setPins(next);
              save("orbit-priorities-v3", next);
            }}
          >
            <option value="">Pin another item…</option>
            {candidates.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {priorities.map((p, i) => (
            <div className="priority-row" key={p.id}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong>{p.title}</strong>
                {p.due && <small>Due {p.due}</small>}
              </div>
              <button
                aria-label={`${pins.includes(p.id) ? "Unpin" : "Pin"} priority ${p.title}`}
                aria-pressed={pins.includes(p.id)}
                onClick={() => {
                  const next = pins.includes(p.id)
                    ? pins.filter((x) => x !== p.id)
                    : [p.id, ...pins].slice(0, 3);
                  setPins(next);
                  save("orbit-priorities-v3", next);
                }}
              >
                <Star
                  size={13}
                  fill={pins.includes(p.id) ? "currentColor" : "none"}
                />
              </button>
            </div>
          ))}
          {!priorities.length && (
            <p className="command-empty">
              Nothing competing for your attention. Capture a task when you need
              one.
            </p>
          )}
        </section>
        <section className="card command-card">
          <h3>
            <GraduationCap size={17} />
            College & teaching
          </h3>
          {responsibilities.slice(0, 4).map((e) => (
            <div className="responsibility-row" key={e.id}>
              <button
                aria-label={`Complete responsibility ${e.title}`}
                onClick={() => {
                  update(e.id, { completed: true });
                  activity(e.title, "Completed");
                }}
              >
                <Check size={13} />
              </button>
              <div>
                <strong>{e.title}</strong>
                <small>
                  {e.domain}
                  {e.due ? ` · ${e.due}` : ""}
                </small>
              </div>
            </div>
          ))}
          {!responsibilities.length && (
            <p className="command-empty">
              Add your actual classes, teaching deadlines, or reminders. Nothing
              is assumed.
            </p>
          )}
          <button className="text-button" onClick={capture}>
            Add a responsibility
            <Plus size={12} />
          </button>
        </section>
        <section className="card command-card">
          <h3>
            <Target size={17} />
            Financial goals
          </h3>
          {entries
            .filter((e) => e.domain === "finance")
            .map((e) => (
              <div className="goal-row" key={e.id}>
                <label>
                  {e.title}
                  <span>
                    ${e.amount.toLocaleString()} / ${e.target.toLocaleString()}
                  </span>
                  <input
                    aria-label={`Current amount for ${e.title}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={e.amount}
                    onChange={(v) =>
                      update(e.id, {
                        amount: Number.isFinite(Number(v.target.value))
                          ? Math.max(0, Number(v.target.value))
                          : 0,
                      })
                    }
                  />
                </label>
                <progress value={e.amount} max={e.target || 1} />
              </div>
            ))}
          {!entries.some((e) => e.domain === "finance") && (
            <p className="command-empty">Add an income or savings target.</p>
          )}
          <button className="text-button" onClick={capture}>
            Set a goal
            <Plus size={12} />
          </button>
        </section>
        <section className="card command-card">
          <h3>
            <Heart size={16} />
            Habits
          </h3>
          {entries
            .filter((e) => e.domain === "habit")
            .map((e) => (
              <button
                className={`habit-row ${e.lastDone === day ? "checked" : ""}`}
                key={e.id}
                aria-pressed={e.lastDone === day}
                onClick={() =>
                  update(e.id, { lastDone: e.lastDone === day ? "" : day })
                }
              >
                <span>
                  {e.lastDone === day ? (
                    <Check size={13} />
                  ) : (
                    <Plus size={13} />
                  )}
                </span>
                {e.title}
                <small>{e.lastDone === day ? "Done today" : "Today"}</small>
              </button>
            ))}
          {!entries.some((e) => e.domain === "habit") && (
            <p className="command-empty">
              Choose a habit that matters to you. Check it off for today; it
              resets on a new day.
            </p>
          )}
          <button className="text-button" onClick={capture}>
            Add a habit
            <Plus size={12} />
          </button>
        </section>
      </div>
      <section className="card approval-card">
        <div>
          <h3>
            <ShieldCheck size={17} />
            Approval & activity
          </h3>
          <p>
            AI suggestions wait here. Only you approve adding them to your
            tasks.
          </p>
        </div>
        <div className="approval-list">
          {pending.length ? (
            pending.map((p) => (
              <div className="approval-row" key={p.id}>
                <div>
                  <span>PROPOSED TASK</span>
                  <strong>{p.title}</strong>
                </div>
                <button
                  onClick={() => {
                    onAddTask(p.title);
                    save(
                      "orbit-pending-v3",
                      pending.filter((x) => x.id !== p.id),
                    );
                    activity(p.title, "Approved and added");
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    save(
                      "orbit-pending-v3",
                      pending.filter((x) => x.id !== p.id),
                    );
                    activity(p.title, "Dismissed");
                  }}
                  aria-label={`Dismiss proposal ${p.title}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))
          ) : (
            <span className="command-empty">
              No actions waiting for approval.
            </span>
          )}
        </div>
        {log.length > 0 && (
          <details>
            <summary>
              <Clock3 size={12} />
              Recent local activity · {log.length}
            </summary>
            {log.slice(0, 6).map((e) => (
              <div className="activity-row" key={e.id}>
                <span>{e.status}</span>
                <strong>{e.title}</strong>
              </div>
            ))}
          </details>
        )}
      </section>
      {entries.length > 0 && (
        <details className="manage-captures">
          <summary>Manage captured items · {entries.length}</summary>
          <p>Removing an item leaves any separate copy in Notes.</p>
          {entries.map((e) => (
            <div key={e.id}>
              <span>
                {e.title}
                <small>{e.domain}</small>
              </span>
              <button
                aria-label={`Remove captured item ${e.title}`}
                onClick={() => {
                  if (
                    window.confirm(`Remove “${e.title}” from captured items?`)
                  ) {
                    save(
                      "orbit-command-v3",
                      entries.filter((x) => x.id !== e.id),
                    );
                    activity(e.title, "Removed");
                  }
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </details>
      )}
      {entries.some((e) => ["note", "idea"].includes(e.domain)) && (
        <div className="captured-note-strip">
          <Inbox size={14} />
          {
            entries.filter((e) => ["note", "idea"].includes(e.domain)).length
          }{" "}
          captured notes and ideas are also saved in Notes.
        </div>
      )}
    </section>
  );
}
