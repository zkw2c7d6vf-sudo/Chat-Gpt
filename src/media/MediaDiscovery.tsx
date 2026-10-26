import { useState } from "react";
import {
  ExternalLink,
  Film,
  Play,
  Search,
  Star,
  Tv,
  UserRound,
  X,
} from "lucide-react";
import "./discovery.css";
type Show = {
  id: number;
  name: string;
  type: string;
  summary: string;
  image: string | null;
  rating: number | null;
  genres: string[];
  premiered: string | null;
  status: string | null;
  imdb: string | null;
  official: string | null;
};
type CastMember = {
  name: string;
  character: string;
  image: string | null;
  imdb: string | null;
};
type Details = { show: Show; cast: CastMember[] };
type Ratings = {
  available: boolean;
  reason?: string;
  ratings?: { source: string; value: string }[];
};
function imageUrl(value: string | null) {
  return value || "";
}
function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname === "youtu.be")
      return url.pathname.slice(1).match(/^[A-Za-z0-9_-]{11}$/)?.[0] || "";
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
      ].includes(url.hostname)
    ) {
      const id =
        url.searchParams.get("v") || url.pathname.split("/").pop() || "";
      return id.match(/^[A-Za-z0-9_-]{11}$/)?.[0] || "";
    }
  } catch {
    /* handled by empty state */
  }
  return "";
}
function cleanSummary(value: string) {
  return value || "No synopsis available.";
}
export default function MediaDiscovery() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Show[]>([]);
  const [selected, setSelected] = useState<Details | null>(null);
  const [ratings, setRatings] = useState<Ratings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeId, setYoutubeId] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("orbit-youtube-watchlist-v1") || "[]",
      );
    } catch {
      return [];
    }
  });
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    setSelected(null);
    try {
      const response = await fetch(
        `/api/media/search?query=${encodeURIComponent(query.trim())}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The catalog could not be searched.");
      setResults(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The catalog could not be searched.",
      );
    } finally {
      setBusy(false);
    }
  };
  const openShow = async (show: Show) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/media/show/${show.id}`);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The cast could not be loaded.");
      setSelected(data);
      setRatings(null);
      if (data.show.imdb) {
        const ratingResponse = await fetch(
          `/api/media/ratings?imdb=${encodeURIComponent(data.show.imdb.split("/").filter(Boolean).pop() || "")}`,
        );
        setRatings(await ratingResponse.json());
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The show could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  };
  const playYouTube = (value = youtubeUrl) => {
    const id = getYouTubeId(value);
    if (!id) {
      setYoutubeError("Paste a standard YouTube watch or youtu.be link.");
      return;
    }
    setYoutubeId(id);
    setYoutubeError("");
  };
  const saveYouTube = () => {
    const id = getYouTubeId(youtubeUrl);
    if (!id) {
      setYoutubeError("Paste a standard YouTube watch or youtu.be link.");
      return;
    }
    const next = [id, ...watchlist.filter((item) => item !== id)].slice(0, 12);
    setWatchlist(next);
    localStorage.setItem("orbit-youtube-watchlist-v1", JSON.stringify(next));
    setYoutubeId(id);
    setYoutubeError("");
  };
  return (
    <section className="media-discovery" aria-label="Watch and discover">
      <div className="discovery-heading">
        <div>
          <span className="media-eyebrow">OPEN CATALOGS & WATCH</span>
          <h2>Explore something to watch</h2>
          <p>
            Search a free TV catalog, inspect its cast, or play a YouTube link
            without leaving Orbit.
          </p>
        </div>
        <span className="discovery-source">TVMaze catalog</span>
      </div>
      <div className="discovery-columns">
        <div className="discovery-catalog">
          <form className="discovery-search" onSubmit={search}>
            <Search size={17} />
            <input
              aria-label="Search shows and movies"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shows and movies"
            />
            <button type="submit" disabled={busy}>
              {busy ? "Searching…" : "Search"}
            </button>
          </form>
          {error && (
            <p className="discovery-error" role="alert">
              {error}
            </p>
          )}
          {results.length > 0 && (
            <div className="discovery-results">
              {results.map((show) => (
                <button
                  className="discovery-result"
                  key={show.id}
                  onClick={() => void openShow(show)}
                >
                  <span className="discovery-poster">
                    {show.image ? (
                      <img src={imageUrl(show.image)} alt="" />
                    ) : (
                      <Film size={22} />
                    )}
                  </span>
                  <span>
                    <strong>{show.name}</strong>
                    <small>
                      {show.type}
                      {show.premiered ? ` · ${show.premiered.slice(0, 4)}` : ""}
                      {show.rating ? ` · ${show.rating}/10` : ""}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="show-detail">
              <button
                className="close-detail"
                aria-label="Close show details"
                onClick={() => setSelected(null)}
              >
                <X size={15} />
              </button>
              <div className="show-title">
                <div className="show-poster">
                  {selected.show.image ? (
                    <img src={selected.show.image} alt="" />
                  ) : (
                    <Tv size={28} />
                  )}
                </div>
                <div>
                  <span className="media-eyebrow">{selected.show.type}</span>
                  <h3>{selected.show.name}</h3>
                  <div className="show-meta">
                    {selected.show.rating && (
                      <span>
                        <Star size={13} /> {selected.show.rating}/10
                      </span>
                    )}
                    {selected.show.status && (
                      <span>{selected.show.status}</span>
                    )}
                  </div>
                  {selected.show.imdb && (
                    <a
                      href={selected.show.imdb}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on IMDb <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
              <p>{cleanSummary(selected.show.summary)}</p>
              <div className="rating-row">
                <strong>Ratings</strong>
                {ratings?.available ? (
                  ratings.ratings?.map((rating) => (
                    <span key={rating.source}>
                      {rating.source}: {rating.value}
                    </span>
                  ))
                ) : (
                  <small>{ratings?.reason || "Checking ratings…"}</small>
                )}
              </div>
              <h4>
                <UserRound size={15} /> Cast
              </h4>
              <div className="cast-grid">
                {selected.cast.map((person) => (
                  <div
                    className="cast-card"
                    key={`${person.name}-${person.character}`}
                  >
                    {person.image ? (
                      <img src={person.image} alt="" />
                    ) : (
                      <span>
                        <UserRound size={17} />
                      </span>
                    )}
                    <strong>{person.name}</strong>
                    <small>{person.character}</small>
                    {person.imdb && (
                      <a href={person.imdb} target="_blank" rel="noreferrer">
                        IMDb <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="youtube-panel">
          <div className="youtube-heading">
            <Play size={16} />
            <h3>YouTube player</h3>
          </div>
          <p>
            Paste a YouTube video link to watch it here. Videos remain subject
            to YouTube’s embed permissions.
          </p>
          <div className="youtube-form">
            <input
              aria-label="YouTube link"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://youtu.be/..."
            />
            <button onClick={() => playYouTube()}>Play</button>
            <button onClick={saveYouTube} aria-label="Save YouTube video">
              Save
            </button>
          </div>
          {youtubeError && (
            <p className="discovery-error" role="alert">
              {youtubeError}
            </p>
          )}
          {youtubeId && (
            <iframe
              title="YouTube player"
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
          {watchlist.length > 0 && (
            <div className="youtube-saved">
              <strong>Saved videos</strong>
              {watchlist.map((id) => (
                <button key={id} onClick={() => setYoutubeId(id)}>
                  <Play size={11} /> {id}
                </button>
              ))}
            </div>
          )}
          <div className="free-watch">
            <strong>Free services to explore</strong>
            <p>
              These services control playback and availability on their own
              sites.
            </p>
            <a
              href={`https://tubitv.com/search/${encodeURIComponent(query || "shows")}`}
              target="_blank"
              rel="noreferrer"
            >
              Search Tubi <ExternalLink size={11} />
            </a>
            <a
              href={`https://pluto.tv/search?query=${encodeURIComponent(query || "shows")}`}
              target="_blank"
              rel="noreferrer"
            >
              Search Pluto TV <ExternalLink size={11} />
            </a>
            <a href="https://watch.sling.com/" target="_blank" rel="noreferrer">
              Browse Sling Freestream <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
