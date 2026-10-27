const MAX_QUERY = 100;
export class MediaError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function queryText(value) {
  const query = String(value || "").trim();
  if (!query || query.length > MAX_QUERY)
    throw new MediaError("Enter a shorter title to search.", 400);
  return query;
}
async function json(fetcher, url) {
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new MediaError(`Media catalog returned HTTP ${response.status}.`);
  return response.json();
}
function normalizeShow(show) {
  return {
    id: Number(show.id),
    name: String(show.name || "Untitled"),
    type: String(show.type || "Show"),
    language: show.language ? String(show.language) : null,
    summary: String(show.summary || "")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 500),
    image: show.image?.medium || show.image?.original || null,
    rating:
      show.rating?.average != null &&
      Number.isFinite(Number(show.rating.average))
        ? Number(show.rating.average)
        : null,
    genres: Array.isArray(show.genres)
      ? show.genres.slice(0, 5).map(String)
      : [],
    premiered: show.premiered || null,
    status: show.status || null,
    imdb: show.externals?.imdb
      ? `https://www.imdb.com/title/${encodeURIComponent(show.externals.imdb)}/`
      : null,
    official: show.officialSite || show.url || null,
  };
}
export function createMediaService({ fetch = globalThis.fetch } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function cached(key, loader, ttl = 300000) {
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve()
      .then(loader)
      .then((value) => {
        cache.delete(key);
        cache.set(key, { value, until: Date.now() + ttl });
        while (cache.size > 80) cache.delete(cache.keys().next().value);
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }
  function showId(value) {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || id > 10_000_000)
      throw new MediaError("That show could not be opened.", 400);
    return id;
  }
  return {
    async popular() {
      return cached(
        "picks",
        async () => {
          const data = await json(fetch, "https://api.tvmaze.com/shows?page=0");
          return Array.isArray(data)
            ? data
                .map(normalizeShow)
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 18)
            : [];
        },
        900000,
      );
    },
    async search(rawQuery) {
      const query = queryText(rawQuery);
      return cached(`search:${query.toLowerCase()}`, async () => {
        const data = await json(
          fetch,
          `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
        );
        return Array.isArray(data)
          ? data.slice(0, 12).map((item) => normalizeShow(item.show || {}))
          : [];
      });
    },
    async show(rawId) {
      const id = showId(rawId);
      return cached(`show:${id}`, async () => {
        const [show, cast] = await Promise.all([
          json(fetch, `https://api.tvmaze.com/shows/${id}`),
          json(fetch, `https://api.tvmaze.com/shows/${id}/cast`),
        ]);
        return {
          show: normalizeShow(show),
          cast: Array.isArray(cast)
            ? cast.slice(0, 24).map((item) => ({
                name: String(item.person?.name || "Unknown"),
                character: String(item.character?.name || ""),
                image:
                  item.person?.image?.medium ||
                  item.person?.image?.original ||
                  null,
                imdb: item.person?.externals?.imdb
                  ? `https://www.imdb.com/name/${encodeURIComponent(item.person.externals.imdb)}/`
                  : null,
              }))
            : [],
        };
      });
    },
    async ratings(imdbId, apiKey) {
      if (!apiKey)
        return {
          available: false,
          reason: "Add OMDB_API_KEY to enable Rotten Tomatoes scores.",
        };
      if (!/^tt\d+$/.test(String(imdbId)))
        throw new MediaError("That IMDb identifier is invalid.", 400);
      const data = await json(
        fetch,
        `https://www.omdbapi.com/?apikey=${encodeURIComponent(apiKey)}&i=${encodeURIComponent(imdbId)}&tomatoes=true`,
      );
      if (data.Response === "False")
        return {
          available: false,
          reason: String(data.Error || "No rating found."),
        };
      const ratings = Array.isArray(data.Ratings) ? data.Ratings : [];
      return {
        available: true,
        title: data.Title || null,
        ratings: ratings.map((rating) => ({
          source: String(rating.Source),
          value: String(rating.Value),
        })),
      };
    },
  };
}
