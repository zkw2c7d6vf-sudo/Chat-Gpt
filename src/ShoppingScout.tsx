import { newId } from "./id";
import { useEffect, useMemo, useRef, useState } from "react";
import { safeHttps } from "./local";
import type { FormEvent } from "react";
import { ExternalLink, Plus, Search, Tag, Trash2, Trophy } from "lucide-react";
import "./shopping.css";

type SavedSearch = { id: string; query: string; createdAt: string };
type StoredSearch = Omit<SavedSearch, "createdAt"> & { createdAt?: unknown };
type Offer = {
  id: string;
  searchId: string;
  store: string;
  url: string;
  image?: string;
  price: number;
  shipping: number;
  note: string;
};
type LiveProduct = {
  id: string;
  title: string;
  image: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  shipping: number | null;
  condition: string | null;
  seller: string | null;
};
const searchesKey = "orbit-shopping-searches-v1";
const offersKey = "orbit-shopping-offers-v1";
const retailers = [
  ["eBay", "https://www.ebay.com/sch/i.html?_nkw="],
  ["Amazon", "https://www.amazon.com/s?k="],
  ["Walmart", "https://www.walmart.com/search?q="],
  ["Target", "https://www.target.com/s?searchTerm="],
  ["Depop", "https://www.depop.com/search/?q="],
  ["Vinted", "https://www.vinted.com/catalog?search_text="],
] as const;
const relatedTerms: Record<string, string[]> = {
  jacket: ["rain jacket", "overshirt", "lightweight coat"],
  coat: ["rain jacket", "overshirt", "lightweight coat"],
  sneaker: ["running shoes", "everyday sneakers", "trail shoes"],
  shoe: ["running shoes", "everyday sneakers", "trail shoes"],
  shirt: ["overshirt", "long sleeve shirt", "linen shirt"],
  jeans: ["straight leg denim", "cargo pants", "corduroy pants"],
  desk: ["desk lamp", "monitor stand", "desk organizer"],
  movie: ["free movies", "new releases", "classic films"],
  show: ["comedy series", "drama series", "limited series"],
};

function load<T>(key: string, valid: (value: unknown) => value is T[]): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return valid(value) ? value : [];
  } catch {
    return [];
  }
}
function searches() {
  return load<StoredSearch>(
    searchesKey,
    (value): value is StoredSearch[] =>
      Array.isArray(value) &&
      value.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.query === "string" &&
          (item.createdAt === undefined || typeof item.createdAt === "string"),
      ),
  ).map((item) => ({
    id: item.id,
    query: item.query,
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : new Date(0).toISOString(),
  }));
}
function offers() {
  return load<Offer>(
    offersKey,
    (value): value is Offer[] =>
      Array.isArray(value) &&
      value.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.searchId === "string" &&
          typeof item.store === "string" &&
          typeof item.url === "string" &&
          (item.image === undefined || typeof item.image === "string") &&
          typeof item.price === "number" &&
          typeof item.shipping === "number" &&
          typeof item.note === "string",
      ),
  );
}
function total(offer: Offer) {
  return offer.price + offer.shipping;
}

export default function ShoppingScout() {
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SavedSearch[]>(searches);
  const [savedOffers, setSavedOffers] = useState<Offer[]>(offers);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [store, setStore] = useState("Amazon");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [liveItems, setLiveItems] = useState<LiveProduct[]>([]);
  const [liveProvider, setLiveProvider] = useState("eBay");
  const [liveMessage, setLiveMessage] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveQuery, setLiveQuery] = useState("popular");
  const [liveSort, setLiveSort] = useState("relevance");
  const [budget, setBudget] = useState("");
  const requestVersion = useRef(0);
  useEffect(
    () => localStorage.setItem(searchesKey, JSON.stringify(saved)),
    [saved],
  );
  useEffect(
    () => localStorage.setItem(offersKey, JSON.stringify(savedOffers)),
    [savedOffers],
  );
  const clean = query.trim().slice(0, 120);
  const loadLive = async (term: string) => {
    const version = ++requestVersion.current;
    setLiveLoading(true);
    try {
      const response = await fetch(
        `/api/shopping/feed?query=${encodeURIComponent(term || "popular")}`,
      );
      const data = await response.json();
      if (version !== requestVersion.current) return;
      if (!response.ok)
        throw new Error(data.error || "Live shopping is unavailable.");
      setLiveItems(Array.isArray(data.items) ? data.items : []);
      setLiveQuery(term);
      setLiveProvider(data.provider || "eBay");
      setLiveMessage(
        data.message ||
          (data.configured ? `Live listings for ${data.query || term}.` : ""),
      );
    } catch (error) {
      if (version !== requestVersion.current) return;
      setLiveItems([]);
      setLiveMessage(
        error instanceof Error
          ? error.message
          : "Live shopping is unavailable.",
      );
    } finally {
      if (version === requestVersion.current) setLiveLoading(false);
    }
  };
  useEffect(() => {
    void loadLive("popular");
    return () => {
      requestVersion.current++;
    };
  }, []);
  const feed = useMemo(
    () =>
      saved.map((item) => ({
        ...item,
        offers: savedOffers.filter((offer) => offer.searchId === item.id),
      })),
    [saved, savedOffers],
  );
  const recommendations = useMemo(() => {
    const existing = new Set(saved.map((item) => item.query.toLowerCase()));
    return saved
      .flatMap((item) =>
        Object.entries(relatedTerms).flatMap(([word, terms]) =>
          item.query.toLowerCase().includes(word) ? terms : [],
        ),
      )
      .filter(
        (term, index, all) =>
          !existing.has(term) && all.indexOf(term) === index,
      )
      .slice(0, 5);
  }, [saved]);
  const addSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!clean) return;
    if (
      saved.length >= 12 &&
      !saved.some((item) => item.query.toLowerCase() === clean.toLowerCase())
    ) {
      setLiveMessage(
        "You have 12 saved searches. Remove one before saving another.",
      );
      return;
    }
    setSaved((current) =>
      current.some((item) => item.query.toLowerCase() === clean.toLowerCase())
        ? current
        : [
            {
              id: newId(),
              query: clean,
              createdAt: new Date().toISOString(),
            },
            ...current,
          ].slice(0, 12),
    );
    setQuery("");
    void loadLive(clean);
  };
  const clearOfferForm = () => {
    setAddingFor(null);
    setStore("Amazon");
    setUrl("");
    setImage("");
    setPrice("");
    setShipping("0");
    setNote("");
    setFormError("");
  };
  const addOffer = (event: FormEvent) => {
    event.preventDefault();
    if (!addingFor) return;
    const itemPrice = Number(price),
      itemShipping = Number(shipping || 0);
    if (
      !Number.isFinite(itemPrice) ||
      itemPrice < 0 ||
      itemPrice > 1e9 ||
      !Number.isFinite(itemShipping) ||
      itemShipping < 0 ||
      itemShipping > 1e9 ||
      savedOffers.length >= 200
    ) {
      setFormError("Enter a valid item price and shipping cost.");
      return;
    }
    if (url && !safeHttps(url.trim())) {
      setFormError("Listing links must begin with https://.");
      return;
    }
    if (image && !safeHttps(image.trim())) {
      setFormError("Image links must begin with https://.");
      return;
    }
    setSavedOffers((current) => [
      {
        id: newId(),
        searchId: addingFor,
        store,
        url: url.trim(),
        image: image.trim(),
        price: itemPrice,
        shipping: itemShipping,
        note: note.trim().slice(0, 140),
      },
      ...current,
    ]);
    clearOfferForm();
  };
  const saveLive = (item: LiveProduct) => {
    if (
      item.price === null ||
      item.shipping === null ||
      item.currency !== "USD" ||
      !safeHttps(item.url)
    ) {
      setLiveMessage(
        "This listing needs a USD price, known shipping, and a valid link before it can be compared.",
      );
      return;
    }
    if (savedOffers.length >= 200) {
      setLiveMessage("The comparison board holds up to 200 saved listings.");
      return;
    }
    const query =
      liveQuery === "popular" ? item.title.slice(0, 120) : liveQuery;
    let search = saved.find(
      (entry) => entry.query.toLowerCase() === query.toLowerCase(),
    );
    if (!search) {
      if (saved.length >= 12) {
        setLiveMessage(
          "Remove a saved search to make room for this comparison.",
        );
        return;
      }
      search = { id: newId(), query, createdAt: new Date().toISOString() };
      setSaved((current) => [search!, ...current]);
    }
    if (
      savedOffers.some(
        (offer) => offer.searchId === search.id && offer.url === item.url,
      )
    )
      return;
    const snapshot: Offer = {
      id: newId(),
      searchId: search.id,
      store: "eBay",
      url: item.url!,
      price: item.price,
      shipping: item.shipping,
      note: item.title.slice(0, 140),
      ...(safeHttps(item.image) ? { image: item.image! } : {}),
    };
    setSavedOffers((current) => [snapshot, ...current]);
    setLiveMessage(
      "Listing saved as a price snapshot. Check the retailer for current stock and checkout total.",
    );
  };
  const visibleLive = [...liveItems]
    .filter(
      (item) =>
        !budget ||
        (item.currency === "USD" &&
          item.price !== null &&
          item.shipping !== null &&
          item.price + item.shipping <= Number(budget)),
    )
    .sort((a, b) =>
      liveSort === "price"
        ? (a.price !== null && a.shipping !== null
            ? a.price + a.shipping
            : Infinity) -
          (b.price !== null && b.shipping !== null
            ? b.price + b.shipping
            : Infinity)
        : 0,
    );
  return (
    <section className="shopping-scout" aria-label="Orbit Shopping Scout">
      <div className="shopping-scout-heading">
        <div>
          <span className="eyebrow">SHOPPING</span>
          <h2>Shopping Scout</h2>
        </div>
        <span className="shopping-status">Local comparison</span>
      </div>
      <p>Search stores, compare listings, and track delivered prices.</p>
      <section className="live-shopping" aria-label="Live shopping listings">
        <div className="live-shopping-heading">
          <div>
            <span className="eyebrow">LIVE CATALOG</span>
            <h3>Browse products</h3>
          </div>
          <span>{liveProvider}</span>
        </div>
        {liveItems.length > 0 && (
          <div className="shopping-live-controls">
            <label>
              Sort
              <select
                aria-label="Sort live products"
                value={liveSort}
                onChange={(event) => setLiveSort(event.target.value)}
              >
                <option value="relevance">Relevance</option>
                <option value="price">Lowest delivered total</option>
              </select>
            </label>
            <label>
              Budget (USD)
              <input
                aria-label="Live shopping budget"
                type="number"
                min="0"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </label>
            <button onClick={() => void loadLive(liveQuery)}>
              Refresh listings
            </button>
          </div>
        )}
        {liveLoading ? (
          <p className="shopping-empty">Loading live listings…</p>
        ) : liveItems.length ? (
          <div className="live-product-grid">
            {visibleLive.map((item) => (
              <article className="live-product" key={item.id}>
                {item.image ? (
                  <img src={item.image} alt="" />
                ) : (
                  <div className="live-product-placeholder">
                    <Tag size={18} />
                  </div>
                )}
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.condition || "Listing"}
                    {item.seller ? ` · ${item.seller}` : ""}
                  </small>
                  {item.price !== null && (
                    <b>
                      {item.currency} {item.price.toFixed(2)}
                      {item.shipping === null
                        ? " · Shipping not provided"
                        : item.shipping > 0
                          ? ` + ${item.shipping.toFixed(2)} shipping`
                          : ""}
                    </b>
                  )}
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${item.title}`}
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  className="save-live-product"
                  aria-label={`Compare ${item.title}`}
                  disabled={
                    item.price === null ||
                    item.shipping === null ||
                    item.currency !== "USD" ||
                    !safeHttps(item.url) ||
                    savedOffers.some((offer) => offer.url === item.url)
                  }
                  onClick={() => saveLive(item)}
                >
                  {savedOffers.some((offer) => offer.url === item.url)
                    ? "Saved"
                    : "Compare"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="shopping-empty">
            {liveMessage ||
              "Live product listings need a connected catalog provider."}
          </p>
        )}
        {!liveLoading && liveItems.length > 0 && !visibleLive.length && (
          <p className="shopping-empty">No listings match this budget.</p>
        )}
        {liveItems.length > 0 && liveMessage && (
          <p className="live-shopping-note" role="status">
            {liveMessage}
          </p>
        )}
        {!liveLoading && liveMessage && !liveItems.length && (
          <small className="live-shopping-note">
            {liveMessage} Saved searches and manual comparisons remain available
            below.
          </small>
        )}
      </section>
      <form onSubmit={addSearch} className="shopping-search">
        <Search size={18} />
        <input
          aria-label="Item to research"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add something you want to find"
          maxLength={120}
        />
        <button
          type="submit"
          disabled={!clean}
          aria-label="Save shopping search"
        >
          <Plus size={16} /> Save
        </button>
      </form>
      {recommendations.length > 0 && (
        <div
          className="shopping-recommendations"
          aria-label="Suggested searches"
        >
          <span>FOR YOU</span>
          {recommendations.map((term) => (
            <button key={term} onClick={() => setQuery(term)}>
              {term} <Plus size={11} />
            </button>
          ))}
        </div>
      )}
      {feed.length ? (
        <div className="shopping-saved">
          {feed.map((item) => {
            const compared = [...item.offers].sort(
              (a, b) => total(a) - total(b),
            );
            return (
              <article key={item.id}>
                <div className="shopping-query-row">
                  <strong>{item.query}</strong>
                  <button
                    className="browse-saved-search"
                    aria-label={`Browse live listings for ${item.query}`}
                    onClick={() => void loadLive(item.query)}
                  >
                    Browse live
                  </button>
                  <button
                    aria-label={`Remove ${item.query}`}
                    onClick={() => {
                      setSaved((current) =>
                        current.filter((x) => x.id !== item.id),
                      );
                      setSavedOffers((current) =>
                        current.filter((x) => x.searchId !== item.id),
                      );
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div
                  className="retailer-links"
                  aria-label={`Search stores for ${item.query}`}
                >
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
                {compared.length ? (
                  <ol
                    className="offer-list"
                    aria-label={`Saved offers for ${item.query}`}
                  >
                    {compared.map((offer, index) => (
                      <li
                        key={offer.id}
                        className={index === 0 ? "best-offer" : ""}
                      >
                        {offer.image && (
                          <img
                            className="offer-thumb"
                            src={offer.image}
                            alt=""
                          />
                        )}
                        <span>
                          {index === 0 ? (
                            <Trophy size={13} aria-label="Lowest saved total" />
                          ) : (
                            <Tag size={13} />
                          )}{" "}
                          {offer.store}
                        </span>
                        <strong>${total(offer).toFixed(2)}</strong>
                        {offer.shipping > 0 && (
                          <small>
                            ${offer.price.toFixed(2)} + $
                            {offer.shipping.toFixed(2)} shipping
                          </small>
                        )}
                        {offer.note && <small>{offer.note}</small>}
                        <div>
                          {offer.url && (
                            <a
                              href={offer.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Listing <ExternalLink size={11} />
                            </a>
                          )}
                          <button
                            aria-label={`Remove ${offer.store} offer for ${item.query}`}
                            onClick={() =>
                              setSavedOffers((current) =>
                                current.filter((x) => x.id !== offer.id),
                              )
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="shopping-empty">No listings saved yet.</div>
                )}
                {addingFor === item.id ? (
                  <form className="offer-form" onSubmit={addOffer}>
                    <label>
                      Store
                      <select
                        value={store}
                        onChange={(event) => setStore(event.target.value)}
                      >
                        {retailers.map(([name]) => (
                          <option key={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Item price
                      <input
                        aria-label="Item price"
                        inputMode="decimal"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </label>
                    <label>
                      Shipping
                      <input
                        aria-label="Shipping cost"
                        inputMode="decimal"
                        value={shipping}
                        onChange={(event) => setShipping(event.target.value)}
                      />
                    </label>
                    <label className="offer-url">
                      Listing link (optional)
                      <input
                        aria-label="Listing link"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <label className="offer-url">
                      Product image URL (optional)
                      <input
                        aria-label="Product image URL"
                        value={image}
                        onChange={(event) => setImage(event.target.value)}
                        placeholder="https://…/image.jpg"
                      />
                    </label>
                    <label className="offer-url">
                      Note (optional)
                      <input
                        aria-label="Listing note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={140}
                      />
                    </label>
                    {formError && <p role="alert">{formError}</p>}
                    <div>
                      <button type="submit">Save offer</button>
                      <button type="button" onClick={clearOfferForm}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="add-offer"
                    onClick={() => {
                      clearOfferForm();
                      setAddingFor(item.id);
                    }}
                  >
                    Compare a listing <Plus size={13} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="shopping-empty">
          Save a search to begin your personal shopping feed.
        </div>
      )}
      <small>
        Orbit compares only listings you save. It does not scrape retailers,
        access accounts, or claim that unsaved prices are current.
      </small>
    </section>
  );
}
