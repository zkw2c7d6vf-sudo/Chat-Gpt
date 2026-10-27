import { newId } from "./id";
import { useState } from "react";
import { ArrowUpRight, Check, CheckCheck, Pencil, Plus, X } from "lucide-react";
import type { Task } from "./data";
import { localDay } from "./local";
import { downloadCsv, downloadText } from "./exports";

export default function TaskPanel({
  tasks,
  setTasks,
  notes,
  setNotes,
  tab,
  setTab,
  compact = false,
}: {
  tasks: Task[];
  setTasks: (update: (tasks: Task[]) => Task[]) => void;
  notes: string;
  setNotes: (notes: string) => void;
  tab: string;
  setTab: (tab: string) => void;
  compact?: boolean;
}) {
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("priority");
  const [editing, setEditing] = useState<Task | null>(null);
  const [removed, setRemoved] = useState<Task | null>(null);
  const today = localDay();
  const done = tasks.filter((task) => task.done).length;
  const urgency = { high: 0, normal: 1, low: 2 };
  const visible = tasks
    .filter(
      (task) =>
        (!compact || !task.done) &&
        (compact ||
          task.title.toLowerCase().includes(query.trim().toLowerCase())) &&
        (compact ||
          filter === "all" ||
          (filter === "open"
            ? !task.done
            : filter === "done"
              ? task.done
              : !task.done && task.dueDate && task.dueDate <= today)),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (sort === "date"
          ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
          : urgency[a.priority || "normal"] -
            urgency[b.priority || "normal"]) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );
  const add = () => {
    const title = input.trim();
    if (!title) return;
    setTasks((current) => [
      ...current,
      { id: newId(), title, done: false, source: "you", dueDate, priority },
    ]);
    setInput("");
  };
  return (
    <section
      className="card tasks-card"
      id="tasks-panel"
      aria-label="Tasks and notes"
    >
      <div className="card-header">
        <div className="task-tabs">
          <button
            className={compact || tab === "tasks" ? "active" : ""}
            onClick={() => setTab("tasks")}
          >
            <CheckCheck size={17} />
            Tasks<span>{tasks.length - done}</span>
          </button>
          <button
            className={tab === "notes" ? "active" : ""}
            onClick={() => setTab("notes")}
          >
            Notes
          </button>
        </div>
      </div>
      {compact || tab === "tasks" ? (
        <>
          {!compact && (
            <div className="task-provenance">
              <input
                type="search"
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                aria-label="Sort tasks"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="priority">Priority first</option>
                <option value="date">Due date first</option>
              </select>
              <button
                disabled={!visible.length}
                onClick={() =>
                  downloadCsv("orbit-tasks.csv", [
                    ["Task", "Due date", "Priority", "Status"],
                    ...visible.map((task) => [
                      task.title,
                      task.dueDate || "",
                      task.priority || "normal",
                      task.done ? "Completed" : "Open",
                    ]),
                  ])
                }
              >
                Export CSV
              </button>
              <select
                aria-label="Filter tasks"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All tasks</option>
                <option value="open">Open</option>
                <option value="today">Due today & overdue</option>
                <option value="done">Completed</option>
              </select>
              <span>
                {done}/{tasks.length} done
              </span>
            </div>
          )}
          <div className="task-list">
            {(compact ? visible.slice(0, 3) : visible).map((task) => (
              <div
                key={task.id}
                className={`task-row ${task.done ? "done" : ""}`}
              >
                <button
                  className="task-toggle"
                  aria-label={`${task.done ? "Uncomplete" : "Complete"} ${task.title}`}
                  onClick={() =>
                    setTasks((current) =>
                      current.map((item) =>
                        item.id === task.id
                          ? { ...item, done: !item.done }
                          : item,
                      ),
                    )
                  }
                >
                  {task.done && <Check size={12} />}
                </button>
                <span>
                  {task.title}
                  <span className="task-metadata">
                    {task.priority === "high" && (
                      <small className="priority-high">High priority</small>
                    )}
                    {task.dueDate && (
                      <small
                        className={
                          !task.done && task.dueDate < today ? "overdue" : ""
                        }
                      >
                        {task.dueDate < today && !task.done
                          ? "Overdue · "
                          : "Due "}
                        {new Date(
                          `${task.dueDate}T12:00:00`,
                        ).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </small>
                    )}
                    {task.source === "build" && (
                      <small className="task-source">OUR BUILD</small>
                    )}
                    {task.source === "assistant" && (
                      <small className="task-source">ORBIT</small>
                    )}
                  </span>
                </span>
                <button
                  className="icon-button task-edit"
                  aria-label={`Edit task ${task.title}`}
                  onClick={() => setEditing({ ...task })}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="icon-button task-delete"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => {
                    setRemoved(task);
                    setTasks((current) =>
                      current.filter((item) => item.id !== task.id),
                    );
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {!visible.length && (
              <p className="task-empty">
                {filter === "today"
                  ? "No tasks due today. Room to plan ahead."
                  : "No tasks in this view."}
              </p>
            )}
          </div>
          {removed && (
            <div className="task-undo" role="status">
              <span>Task removed</span>
              <button
                onClick={() => {
                  setTasks((current) =>
                    current.some((item) => item.id === removed.id)
                      ? current
                      : [...current, removed],
                  );
                  setRemoved(null);
                }}
              >
                Undo
              </button>
            </div>
          )}
          {editing && (
            <form
              className="task-editor"
              aria-label="Edit task"
              onSubmit={(event) => {
                event.preventDefault();
                if (!editing.title.trim()) return;
                setTasks((current) =>
                  current.map((item) =>
                    item.id === editing.id
                      ? { ...editing, title: editing.title.trim() }
                      : item,
                  ),
                );
                setEditing(null);
              }}
            >
              <label>
                Task
                <input
                  aria-label="Task title"
                  value={editing.title}
                  maxLength={200}
                  required
                  onChange={(event) =>
                    setEditing({ ...editing, title: event.target.value })
                  }
                />
              </label>
              <label>
                Due date
                <input
                  aria-label="Edit task due date"
                  type="date"
                  value={editing.dueDate || ""}
                  onChange={(event) =>
                    setEditing({ ...editing, dueDate: event.target.value })
                  }
                />
              </label>
              <label>
                Priority
                <select
                  aria-label="Edit task priority"
                  value={editing.priority || "normal"}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      priority: event.target.value as Task["priority"],
                    })
                  }
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <div>
                <button type="submit" className="primary-button">
                  Save changes
                </button>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!compact && (
            <form
              className="add-task"
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
            >
              <Plus size={15} />
              <input
                aria-label="Add a little to-do"
                placeholder="Add a next step…"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={200}
              />
              <input
                type="date"
                aria-label="Task due date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
              <select
                aria-label="Task priority"
                value={priority || "normal"}
                onChange={(event) =>
                  setPriority(event.target.value as Task["priority"])
                }
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              {input.trim() && (
                <button
                  className="icon-button"
                  type="submit"
                  aria-label="Save task"
                >
                  <ArrowUpRight size={15} />
                </button>
              )}
            </form>
          )}
        </>
      ) : (
        <div className="notes-area">
          <button
            className="text-button"
            disabled={!notes}
            onClick={() => downloadText("orbit-notes.txt", notes)}
          >
            Download notes
          </button>
          <textarea
            aria-label="Private notes"
            placeholder="A thought, an idea, something to remember…"
            value={notes}
            maxLength={500000}
            onChange={(event) => setNotes(event.target.value)}
          />
          <span>
            <Check size={11} />
            Saved on this device ·{" "}
            {notes.trim() ? notes.trim().split(/\s+/).length : 0} words
          </span>
        </div>
      )}
    </section>
  );
}
