import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  LoaderCircle,
  MapPin,
  Moon,
  RotateCcw,
  Search,
  Sun,
  Wind,
  X,
} from "lucide-react";
import "./widgets.css";

type Location = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  timezone?: string;
};
type Unit = "fahrenheit" | "celsius";
export type WeatherData = {
  location: Location;
  unit: Unit;
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    isDay: boolean;
    time: string;
  };
  daily: {
    date: string;
    high: number;
    low: number;
    weatherCode: number;
    precipitationChance: number;
  }[];
  updatedAt: string;
  attribution: string;
};
const buffalo: Location = {
  name: "Buffalo",
  latitude: 42.8864,
  longitude: -78.8784,
  country: "United States",
  region: "New York",
};
const weatherCache = new Map<string, { at: number; data: WeatherData }>();
function savedLocation(): Location {
  try {
    const data = JSON.parse(
      localStorage.getItem("orbit-weather-location") || "null",
    );
    if (
      data &&
      typeof data.name === "string" &&
      Number.isFinite(data.latitude) &&
      Number.isFinite(data.longitude) &&
      Math.abs(data.latitude) <= 90 &&
      Math.abs(data.longitude) <= 180
    )
      return data;
  } catch {
    /* Use the default when browser storage is unavailable. */
  }
  return buffalo;
}
function savedUnit(): Unit {
  try {
    return localStorage.getItem("orbit-weather-unit") === "celsius"
      ? "celsius"
      : "fahrenheit";
  } catch {
    return "fahrenheit";
  }
}
export function weatherDescription(code: number) {
  if (code === 0) return "Clear skies";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Misty skies";
  if (code <= 57) return "Light drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
function WeatherIcon({
  code,
  isDay = true,
  size = 24,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
}) {
  const Icon =
    code === 0
      ? isDay
        ? Sun
        : Moon
      : code <= 2
        ? CloudSun
        : code === 3
          ? Cloud
          : code <= 48
            ? CloudFog
            : code <= 57
              ? CloudDrizzle
              : code <= 67
                ? CloudRain
                : code <= 77
                  ? CloudSnow
                  : code <= 82
                    ? CloudRain
                    : code <= 86
                      ? CloudSnow
                      : CloudLightning;
  return <Icon size={size} strokeWidth={1.45} aria-hidden="true" />;
}
export default function WeatherPanel({
  onWeather,
}: {
  onWeather?: (summary: string) => void;
}) {
  const [location, setLocation] = useState<Location>(savedLocation);
  const [unit, setUnit] = useState<Unit>(savedUnit);
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchController, setSearchController] =
    useState<AbortController | null>(null);
  const onWeatherRef = useRef(onWeather);
  useEffect(() => {
    onWeatherRef.current = onWeather;
  }, [onWeather]);
  useEffect(() => {
    const controller = new AbortController();
    const key = `${location.latitude},${location.longitude},${unit}`;
    const cached = weatherCache.get(key);
    setData(cached?.data || null);
    onWeatherRef.current?.("");
    setError("");
    const update = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          name: location.name,
          unit,
        });
        const response = await fetch(`/api/weather?${params}`, {
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Weather is unavailable right now.");
        if (!body.current || !Array.isArray(body.daily))
          throw new Error(
            "The weather service returned an incomplete forecast.",
          );
        weatherCache.set(key, { at: Date.now(), data: body });
        if (!controller.signal.aborted) {
          setData(body);
          setError("");
          onWeatherRef.current?.(
            `${body.location.name}: ${Math.round(body.current.temperature)}°${unit === "fahrenheit" ? "F" : "C"}, ${weatherDescription(body.current.weatherCode)}. Feels like ${Math.round(body.current.feelsLike)}°. Forecast from Open-Meteo.`,
          );
        }
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load the forecast. Try again.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    if (cached && Date.now() - cached.at < 5 * 60000 && retry === 0) {
      setLoading(false);
      onWeatherRef.current?.(
        `${cached.data.location.name}: ${Math.round(cached.data.current.temperature)}°${unit === "fahrenheit" ? "F" : "C"}, ${weatherDescription(cached.data.current.weatherCode)}.`,
      );
    } else void update();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void update();
    }, 15 * 60000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [location, unit, retry]);
  useEffect(() => () => searchController?.abort(), [searchController]);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setSearchError("Enter at least two letters to find a city.");
      return;
    }
    searchController?.abort();
    const controller = new AbortController();
    setSearchController(controller);
    setSearching(true);
    setSearchError("");
    setSearched(false);
    try {
      const response = await fetch(
        `/api/weather/locations?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Couldn't search for that location.");
      if (!controller.signal.aborted) {
        setLocations(body.locations || []);
        setSearched(true);
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setSearchError(
          err instanceof Error
            ? err.message
            : "Location search is unavailable. Try again.",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  function choose(next: Location) {
    setLocation(next);
    setRetry(0);
    setEditing(false);
    setLocations([]);
    setQuery("");
    try {
      localStorage.setItem("orbit-weather-location", JSON.stringify(next));
    } catch {
      /* The weather panel still works without persistence. */
    }
  }
  function changeUnit(next: Unit) {
    setUnit(next);
    setRetry(0);
    try {
      localStorage.setItem("orbit-weather-unit", next);
    } catch {
      /* Keep the setting for this session. */
    }
  }
  return (
    <section className="card weather-card" aria-label="Weather">
      <div className="weather-header">
        <h2>
          <CloudSun size={17} />
          Outside your orbit
        </h2>
        <div className="weather-unit-toggle" aria-label="Temperature units">
          <button
            type="button"
            className={unit === "fahrenheit" ? "active" : ""}
            aria-pressed={unit === "fahrenheit"}
            onClick={() => changeUnit("fahrenheit")}
          >
            °F
          </button>
          <button
            type="button"
            className={unit === "celsius" ? "active" : ""}
            aria-pressed={unit === "celsius"}
            onClick={() => changeUnit("celsius")}
          >
            °C
          </button>
        </div>
      </div>
      <button
        type="button"
        className="weather-location"
        aria-expanded={editing}
        onClick={() => {
          setEditing(!editing);
          setSearchError("");
          setSearched(false);
        }}
      >
        <MapPin size={13} />
        <span>{location.name}</span>
        <ChevronDown size={13} />
      </button>
      {editing && (
        <div className="weather-location-picker">
          <form onSubmit={search}>
            <Search size={15} />
            <input
              autoFocus
              aria-label="Search weather location"
              placeholder="Find a city…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
                setSearchError("");
              }}
              maxLength={100}
            />
            <button
              type="submit"
              disabled={searching}
              aria-label="Search cities"
            >
              {searching ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <ArrowUpRight size={16} />
              )}
            </button>
            <button
              type="button"
              aria-label="Close location search"
              onClick={() => setEditing(false)}
            >
              <X size={14} />
            </button>
          </form>
          {searchError && (
            <p className="widget-error" role="alert">
              {searchError}
            </p>
          )}
          {searched && !locations.length && !searchError && (
            <p className="weather-no-results">
              No city found. Try a nearby city or add the country.
            </p>
          )}
          {locations.length > 0 && (
            <div className="weather-location-results">
              {locations.map((item, i) => (
                <button
                  type="button"
                  key={`${item.latitude},${item.longitude},${i}`}
                  onClick={() => choose(item)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {[item.region, item.country].filter(Boolean).join(", ")}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="weather-default"
            onClick={() => choose(buffalo)}
          >
            Reset to Buffalo, NY
          </button>
        </div>
      )}
      {data ? (
        <>
          <div className="weather-current">
            <div>
              <strong>
                {Math.round(data.current.temperature)}
                <span>°</span>
              </strong>
              <div>
                <p>{weatherDescription(data.current.weatherCode)}</p>
                <span>Feels like {Math.round(data.current.feelsLike)}°</span>
              </div>
            </div>
            <span className="weather-main-icon">
              <WeatherIcon
                code={data.current.weatherCode}
                isDay={data.current.isDay}
                size={57}
              />
            </span>
          </div>
          <div className="weather-conditions">
            <span>
              <Wind size={13} />
              {Math.round(data.current.windSpeed)}{" "}
              {unit === "fahrenheit" ? "mph" : "km/h"}
            </span>
            <span>
              <Droplets size={13} />
              {Math.round(data.current.humidity)}% humidity
            </span>
          </div>
          <div className="weather-forecast" aria-label="Five-day forecast">
            {data.daily.slice(0, 5).map((day, i) => (
              <div key={day.date}>
                <span>
                  {i === 0
                    ? "Today"
                    : new Date(`${day.date}T12:00:00`).toLocaleDateString(
                        "en-US",
                        { weekday: "short" },
                      )}
                </span>
                <WeatherIcon code={day.weatherCode} size={19} />
                <strong>
                  {Math.round(day.high)}°<small>{Math.round(day.low)}°</small>
                </strong>
                <span className="weather-rain" title="Chance of precipitation">
                  {Math.round(day.precipitationChance || 0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : loading ? (
        <div className="weather-loading" role="status">
          <LoaderCircle size={25} className="spin" />
          <p>Checking the skies in {location.name}…</p>
        </div>
      ) : (
        <div className="weather-unavailable">
          <Cloud size={35} />
          <h3>No forecast just yet.</h3>
          <p>Weather needs an internet connection. Your location is saved.</p>
        </div>
      )}
      {error && (
        <div className="weather-error">
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            <RotateCcw size={12} />
            Retry
          </button>
        </div>
      )}
      <div className="weather-attribution">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather by Open-Meteo <ArrowUpRight size={10} />
        </a>
        {loading && data ? (
          <LoaderCircle size={12} className="spin" />
        ) : data ? (
          <span>
            <Check size={10} />
            {error ? "Saved forecast" : "Live forecast"}
          </span>
        ) : null}
      </div>
    </section>
  );
}
