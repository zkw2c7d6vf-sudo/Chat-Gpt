import { newId } from "./id";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
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
  try {
    const x = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(x)
      ? x.filter(
          (e) =>
            e &&
            typeof e.label === "string" &&
            Number.isFinite(e.amount) &&
            ["income", "expense"].includes(e.kind),
        )
      : [];
  } catch {
    return [];
  }
}
export default function FinancePanel() {
  const [entries, setEntries] = useState<Entry[]>(read);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Entry["kind"]>("expense");
  useEffect(
    () => localStorage.setItem(key, JSON.stringify(entries)),
    [entries],
  );
  const total = useMemo(
    () =>
      entries.reduce(
        (n, e) => n + (e.kind === "income" ? e.amount : -e.amount),
        0,
      ),
    [entries],
  );
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const n = Number(amount);
    if (!label.trim() || !Number.isFinite(n) || n <= 0) return;
    setEntries([
      {
        id: newId(),
        label: label.trim(),
        amount: n,
        kind,
        date: new Date().toISOString(),
      },
      ...entries,
    ]);
    setLabel("");
    setAmount("");
  };
  return (
    <section className="finance-panel">
      <header>
        <div>
          <span className="eyebrow">PRIVATE · THIS BROWSER</span>
          <h2>
            <Wallet size={20} /> Finances
          </h2>
        </div>
        <strong className={total < 0 ? "negative" : ""}>
          {total < 0 ? "−" : ""}${Math.abs(total).toFixed(2)}
        </strong>
      </header>
      <p>
        Track amounts you enter manually. Orbit does not connect to your bank.
      </p>
      <form onSubmit={add}>
        <input
          aria-label="Finance item"
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
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button>
          <Plus size={15} /> Add
        </button>
      </form>
      <div className="finance-list">
        {entries.length ? (
          entries.map((e) => (
            <article key={e.id}>
              <span>
                <strong>{e.label}</strong>
                <small>{new Date(e.date).toLocaleDateString()}</small>
              </span>
              <b className={e.kind}>
                {" "}
                {e.kind === "income" ? "+" : "−"}${e.amount.toFixed(2)}
              </b>
              <button
                aria-label={`Delete ${e.label}`}
                onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))
        ) : (
          <div className="finance-empty">
            No entries yet. Add an income or expense to start tracking.
          </div>
        )}
      </div>
    </section>
  );
}
