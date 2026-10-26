import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import "./shopping.css";

type SavedSearch = { id: string; query: string };
const storageKey = "orbit-shopping-searches-v1";
const retailers = [
  ["Amazon", "https://www.amazon.com/s?k="],
  ["Walmart", "https://www.walmart.com/search?q="],
  ["Target", "https://www.target.com/s?searchTerm="],
  ["Depop", "https://www.depop.com/search/?q="],
  ["Vinted", "https://www.vinted.com/catalog?search_text="],
] as const;

function load(): SavedSearch[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value)
      ? value.filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.query === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export default function ShoppingScout() {
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SavedSearch[]>(load);
  useEffect(
    () => localStorage.setItem(storageKey, JSON.stringify(saved)),
    [saved],
  );
  const clean = query.trim().slice(0, 120);
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!clean) return;
    setSaved((current) =>
      current.some((item) => item.query.toLowerCase() === clean.toLowerCase())
        ? current
        : [{ id: crypto.randomUUID(), query: clean }, ...current].slice(0, 12),
    );
    setQuery("");
  };
  return (
    <section className="shopping-scout" aria-label="Orbit Shopping Scout">
      <div className="shopping-scout-heading">
        <div>
          <span className="eyebrow">RESEARCH</span>
          <h2>Shopping Scout</h2>
        </div>
        <span className="shopping-status">Prototype</span>
      </div>
      <p>
        Save something you are considering, then open the same search at each
        retailer. Prices and availability stay on the retailer’s site.
      </p>
      <form onSubmit={add} className="shopping-search">
        <Search size={16} />
        <input
          aria-label="Item to research"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="What are you looking for?"
          maxLength={120}
        />
        <button
          type="submit"
          disabled={!clean}
          aria-label="Save shopping search"
        >
          <Plus size={16} />
          Save
        </button>
      </form>
      {saved.length ? (
        <div className="shopping-saved">
          {saved.map((item) => (
            <article key={item.id}>
              <div className="shopping-query-row">
                <strong>{item.query}</strong>
                <button
                  aria-label={`Remove ${item.query}`}
                  onClick={() =>
                    setSaved((current) =>
                      current.filter((x) => x.id !== item.id),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="retailer-links">
                {retailers.map(([name, base]) => (
                  <a
                    key={name}
                    href={`${base}${encodeURIComponent(item.query)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {name} <ExternalLink size={11} />
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="shopping-empty">Saved searches will appear here.</div>
      )}
      <small>
        Orbit does not scrape retailer sites, access accounts, or claim a live
        best price. A future comparison feature needs approved retailer data
        access or affiliate product feeds.
      </small>
    </section>
  );
}
