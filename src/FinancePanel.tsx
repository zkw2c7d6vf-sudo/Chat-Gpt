import { newId } from "./id";
import { useState } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { localDay, readLocal, writeLocal } from "./local";
import { downloadCsv } from "./exports";
import "./finance.css";
type Entry = {
  id: string;
  label: string;
  amount: number;
  kind: "income" | "expense";
  date: string;
};
const key = "orbit-finance-v1";
function read(): Entry[] {
  const value = readLocal<unknown>(key, []);
  return Array.isArray(value)
    ? value.filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.label === "string" &&
          Number.isFinite(e.amount) &&
          e.amount >= 0 &&
          ["income", "expense"].includes(e.kind) &&
          typeof e.date === "string" &&
          Number.isFinite(Date.parse(e.date)),
      )
    : [];
}
const money = (cents: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
export default function FinancePanel() {
  const [entries, setEntries] = useState<Entry[]>(read);
  const [label, setLabel] = useState(""),
    [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Entry["kind"]>("expense");
  const [date, setDate] = useState(localDay()),
    [month, setMonth] = useState("");
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all");
  const [editing, setEditing] = useState<string | null>(null),
    [removed, setRemoved] = useState<Entry | null>(null),
    [error, setError] = useState("");
  const commit = (next: Entry[]) => {
    if (!writeLocal(key, next)) {
      setError("Could not save. Keep this page open and export your data.");
      return false;
    }
    setEntries(next);
    setError("");
    return true;
  };
  const visible = entries
    .filter(
      (e) =>
        (!month || localDay(new Date(e.date)).startsWith(month)) &&
        (type === "all" || type === e.kind) &&
        e.label.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const income = visible
    .filter((e) => e.kind === "income")
    .reduce((n, e) => n + Math.round(e.amount * 100), 0);
  const expense = visible
    .filter((e) => e.kind === "expense")
    .reduce((n, e) => n + Math.round(e.amount * 100), 0);
  const cancel = () => {
    setEditing(null);
    setLabel("");
    setAmount("");
    setDate(localDay());
  };
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const n = Number(amount);
    if (
      !label.trim() ||
      !Number.isFinite(n) ||
      n <= 0 ||
      n > 1e9 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date))
    ) {
      setError("Enter a label, date and amount between $0.01 and $1 billion.");
      return;
    }
    if (!editing && entries.length >= 1000) {
      setError(
        "Export your entries before removing older records; the limit is 1,000.",
      );
      return;
    }
    const entry: Entry = {
      id: editing || newId(),
      label: label.trim(),
      amount: Math.round(n * 100) / 100,
      kind,
      date: new Date(`${date}T12:00:00`).toISOString(),
    };
    if (
      commit(
        editing
          ? entries.map((e) => (e.id === editing ? entry : e))
          : [entry, ...entries],
      )
    )
      cancel();
  };
  return (
    <section className="finance-panel" aria-label="Finances">
      <header>
        <div>
          <span className="eyebrow">MANUAL LEDGER · USD</span>
          <h2>
            <Wallet size={20} /> Finances
          </h2>
        </div>
        <strong className={income < expense ? "negative" : ""}>
          {money(income - expense)}
        </strong>
      </header>
      <p>Track income and expenses. Totals follow the filters below.</p>
      <div className="module-stats">
        <div>
          <strong>{money(income)}</strong>
          <span>Income</span>
        </div>
        <div>
          <strong>{money(expense)}</strong>
          <span>Expenses</span>
        </div>
        <div>
          <strong>{visible.length}</strong>
          <span>Matching entries</span>
        </div>
      </div>
      <div className="module-filters">
        <input
          type="search"
          aria-label="Search finances"
          placeholder="Search entries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input
          type="month"
          aria-label="Finance month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <select
          aria-label="Filter finance type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </select>
        <button
          onClick={() => {
            setQuery("");
            setMonth("");
            setType("all");
          }}
        >
          Clear filters
        </button>
        <button
          disabled={!visible.length}
          onClick={() =>
            downloadCsv("orbit-finances.csv", [
              ["Date", "Description", "Type", "Amount (USD)"],
              ...visible.map((e) => [
                localDay(new Date(e.date)),
                e.label,
                e.kind,
                e.amount,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <form
        aria-label={editing ? "Edit finance entry" : "Add finance entry"}
        onSubmit={add}
      >
        <input
          aria-label="Finance item"
          required
          maxLength={160}
          placeholder="Paycheck, groceries…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          aria-label="Finance type"
          value={kind}
          onChange={(e) => setKind(e.target.value as Entry["kind"])}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          aria-label="Amount"
          type="number"
          min="0.01"
          max="1000000000"
          step="0.01"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          aria-label="Finance date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="submit">
          <Plus size={15} />
          {editing ? "Save entry" : "Add"}
        </button>
        {editing && (
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {removed && (
        <div className="module-notice" role="status">
          Entry removed.
          <button
            onClick={() => {
              if (
                commit(
                  entries.some((e) => e.id === removed.id)
                    ? entries
                    : [removed, ...entries],
                )
              )
                setRemoved(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
      <div className="finance-list">
        {visible.length ? (
          visible.map((e) => (
            <article key={e.id}>
              <span>
                <strong>{e.label}</strong>
                <small>{new Date(e.date).toLocaleDateString()}</small>
              </span>
              <b className={e.kind}>
                {e.kind === "income" ? "+" : "−"}
                {money(Math.round(e.amount * 100))}
              </b>
              <button
                aria-label={`Edit finance ${e.label}`}
                onClick={() => {
                  setEditing(e.id);
                  setLabel(e.label);
                  setAmount(String(e.amount));
                  setKind(e.kind);
                  setDate(localDay(new Date(e.date)));
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                aria-label={`Delete ${e.label}`}
                onClick={() => {
                  if (commit(entries.filter((x) => x.id !== e.id))) {
                    setRemoved(e);
                    if (editing === e.id) cancel();
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))
        ) : (
          <div className="finance-empty">
            {entries.length
              ? "No entries match these filters."
              : "No entries yet. Add an income or expense to start tracking."}
          </div>
        )}
      </div>
    </section>
  );
}
