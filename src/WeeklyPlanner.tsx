import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import type { CalendarEvent, Task } from "./data";
import { eventOnDay, shortTime } from "./data";
import type { EducationRecord } from "./education";
import { useState } from "react";
import { localDay } from "./local";
import "./modules.css";
export default function WeeklyPlanner({
  date,
  setDate,
  events,
  tasks,
  education,
  onTask,
  onEvent,
  onEducation,
}: {
  date: Date;
  setDate: (date: Date) => void;
  events: CalendarEvent[];
  tasks: Task[];
  education: EducationRecord[];
  onTask: (id: string, patch: Partial<Task>) => void;
  onEvent: (event: CalendarEvent) => void;
  onEducation: () => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const matches = (title: string) =>
    title.toLowerCase().includes(query.trim().toLowerCase());
  const overdue = tasks.filter(
    (task) =>
      !task.done &&
      task.dueDate &&
      task.dueDate < localDay() &&
      matches(task.title),
  );
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return day;
  });
  const shift = (direction: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + direction * 7);
    setDate(next);
  };
  return (
    <section
      className="weekly-planner module-surface"
      aria-label="Weekly planner"
    >
      <header className="module-header">
        <div>
          <span className="eyebrow">
            WEEK OF{" "}
            {monday.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <h2>
            <CalendarDays size={23} />
            Your week
          </h2>
        </div>
        <div className="planner-navigation">
          <button
            className="icon-button"
            aria-label="Previous planner week"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setDate(new Date())}>Today</button>
          <button
            className="icon-button"
            aria-label="Next planner week"
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>
      <div className="module-filters">
        <input
          type="search"
          aria-label="Search planner"
          placeholder="Search this week"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Planner source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="all">All sources</option>
          <option value="calendar">Calendar</option>
          <option value="tasks">Tasks</option>
          <option value="education">Education</option>
        </select>
        {(query || source !== "all") && (
          <button
            onClick={() => {
              setQuery("");
              setSource("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {overdue.length > 0 && (source === "all" || source === "tasks") && (
        <details className="planner-unscheduled">
          <summary>Overdue tasks · {overdue.length}</summary>
          <div>
            {overdue.map((task) => (
              <label key={task.id}>
                <span>
                  {task.title}
                  <small className="overdue"> · Due {task.dueDate}</small>
                </span>
                <button
                  aria-label={`Move ${task.title} to today`}
                  onClick={() => onTask(task.id, { dueDate: localDay() })}
                >
                  Move to today
                </button>
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="planner-week">
        {days.map((day) => {
          const key = localDay(day);
          const dated = tasks.filter(
            (task) =>
              task.dueDate === key &&
              matches(task.title) &&
              (source === "all" || source === "tasks"),
          );
          const academic = education.filter(
            (record) =>
              record.dueDate === key &&
              record.status !== "done" &&
              matches(`${record.title} ${record.course}`) &&
              (source === "all" || source === "education"),
          );
          const scheduled = events.filter(
            (event) =>
              eventOnDay(event, day) &&
              matches(event.title) &&
              (source === "all" || source === "calendar"),
          );
          return (
            <section
              className={`planner-day ${key === localDay() ? "today" : ""}`}
              key={key}
              aria-label={day.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData(
                  "application/x-orbit-task",
                );
                if (tasks.some((task) => task.id === id))
                  onTask(id, { dueDate: key });
              }}
            >
              <header>
                <span>
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <strong>{day.getDate()}</strong>
              </header>
              {scheduled.map((event) => (
                <button
                  className="planner-event"
                  key={event.id}
                  onClick={() => onEvent(event)}
                >
                  <small>
                    {event.allDay ? "All day" : shortTime(event.start)}
                  </small>
                  <strong>{event.title}</strong>
                </button>
              ))}
              {dated.map((task) => (
                <div
                  className={`planner-task ${task.done ? "done" : ""}`}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData(
                      "application/x-orbit-task",
                      task.id,
                    )
                  }
                  key={task.id}
                >
                  <button
                    aria-label={`${task.done ? "Reopen" : "Complete"} planner task ${task.title}`}
                    onClick={() => onTask(task.id, { done: !task.done })}
                  >
                    <Check size={12} />
                    <span>{task.title}</span>
                  </button>
                  <small>{task.priority || "normal"} priority</small>
                  <input
                    type="date"
                    aria-label={`Reschedule ${task.title}`}
                    value={task.dueDate}
                    onChange={(event) =>
                      onTask(task.id, { dueDate: event.target.value })
                    }
                  />
                </div>
              ))}
              {academic.map((record) => (
                <button
                  className="planner-education"
                  key={record.id}
                  onClick={onEducation}
                >
                  <GraduationCap size={13} />
                  <strong>{record.title}</strong>
                  <small>{record.course || record.domain}</small>
                </button>
              ))}
              {!scheduled.length && !dated.length && !academic.length && (
                <p className="planner-empty">No scheduled items</p>
              )}
            </section>
          );
        })}
      </div>
      <details className="planner-unscheduled" open>
        <summary>
          Unscheduled tasks ·{" "}
          {
            tasks.filter(
              (task) =>
                !task.dueDate &&
                !task.done &&
                matches(task.title) &&
                (source === "all" || source === "tasks"),
            ).length
          }
        </summary>
        <div>
          {tasks
            .filter(
              (task) =>
                !task.dueDate &&
                !task.done &&
                matches(task.title) &&
                (source === "all" || source === "tasks"),
            )
            .map((task) => (
              <label
                key={task.id}
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData(
                    "application/x-orbit-task",
                    task.id,
                  )
                }
              >
                <span>{task.title}</span>
                <input
                  aria-label={`Schedule ${task.title}`}
                  type="date"
                  value=""
                  onChange={(event) =>
                    onTask(task.id, { dueDate: event.target.value })
                  }
                />
              </label>
            ))}
        </div>
      </details>
    </section>
  );
}
