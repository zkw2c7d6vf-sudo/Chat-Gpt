const FORECAST_TTL = 5 * 60 * 1000;
const LOCATIONS_TTL = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 15_000;

export class WeatherError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "WeatherError";
    this.status = status;
  }
}

function coordinate(params, name, fallback, min, max) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const value = raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new WeatherError(
      `Choose a valid ${name} between ${min} and ${max}.`,
      400,
    );
  }
  return value;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function displayName(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string" || value.length > 120) {
    throw new WeatherError(
      "Location names must contain at most 120 characters.",
      400,
    );
  }
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim() || fallback;
}

/** A public-data service. It never needs a user credential or device location. */
export function createWeatherService({
  fetch: fetcher = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const forecasts = new Map();
  const locations = new Map();
  const pending = new Map();

  async function cached(cache, key, limit, ttl, request) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.value;
    if (hit) cache.delete(key);
    if (pending.has(key)) return pending.get(key);
    const promise = request()
      .then((value) => {
        cache.set(key, { expiresAt: now() + ttl, value });
        while (cache.size > limit) cache.delete(cache.keys().next().value);
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  async function requestJson(url, errorMessage) {
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Unavailable upstream");
      const value = await response.json();
      if (!value || typeof value !== "object" || value.error)
        throw new Error("Invalid upstream response");
      return value;
    } catch {
      throw new WeatherError(errorMessage);
    }
  }

  async function getWeather(params = new URLSearchParams()) {
    const latitude = coordinate(params, "latitude", 42.8864, -90, 90);
    const longitude = coordinate(params, "longitude", -78.8784, -180, 180);
    const unit = params.get("unit") || "fahrenheit";
    if (!["fahrenheit", "celsius"].includes(unit))
      throw new WeatherError(
        "Choose fahrenheit or celsius for the weather unit.",
        400,
      );
    const name = displayName(
      params.get("name"),
      latitude === 42.8864 && longitude === -78.8784
        ? "Buffalo"
        : "Selected location",
    );
    const key = `forecast:${latitude}:${longitude}:${unit}`;
    const forecast = await cached(
      forecasts,
      key,
      100,
      FORECAST_TTL,
      async () => {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.search = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current:
            "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
          daily:
            "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
          temperature_unit: unit,
          wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
          timezone: "auto",
          forecast_days: "7",
        }).toString();
        const data = await requestJson(
          url,
          "Weather is unavailable right now. Please try again shortly.",
        );
        const current = data.current;
        const daily = data.daily;
        if (
          !current ||
          !daily ||
          typeof data.timezone !== "string" ||
          ![
            current.temperature_2m,
            current.apparent_temperature,
            current.relative_humidity_2m,
            current.wind_speed_10m,
            current.weather_code,
            current.is_day,
          ].every(finite) ||
          typeof current.time !== "string" ||
          !Array.isArray(daily.time) ||
          daily.time.length < 1 ||
          ![
            daily.temperature_2m_max,
            daily.temperature_2m_min,
            daily.precipitation_probability_max,
            daily.weather_code,
          ].every(Array.isArray)
        ) {
          throw new WeatherError(
            "Weather data was incomplete. Please try again shortly.",
          );
        }
        const days = daily.time.slice(0, 7).map((date, index) => {
          const high = daily.temperature_2m_max[index];
          const low = daily.temperature_2m_min[index];
          const weatherCode = daily.weather_code[index];
          const precipitationChance =
            daily.precipitation_probability_max[index];
          if (
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            ![high, low, weatherCode].every(finite) ||
            !(precipitationChance === null || finite(precipitationChance))
          ) {
            throw new WeatherError(
              "Weather forecast was incomplete. Please try again shortly.",
            );
          }
          return { date, high, low, weatherCode, precipitationChance };
        });
        return {
          timezone: data.timezone,
          current: {
            temperature: current.temperature_2m,
            feelsLike: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            weatherCode: current.weather_code,
            isDay: Boolean(current.is_day),
            time: current.time,
          },
          daily: days,
          updatedAt: new Date(now()).toISOString(),
        };
      },
    );
    return {
      location: { name, latitude, longitude, timezone: forecast.timezone },
      unit,
      current: forecast.current,
      daily: forecast.daily,
      updatedAt: forecast.updatedAt,
      attribution: "Open-Meteo",
    };
  }

  async function searchLocations(params = new URLSearchParams()) {
    const query = (params.get("q") || "").trim();
    if (query.length < 2 || query.length > 100)
      throw new WeatherError(
        "Enter a city name between 2 and 100 characters.",
        400,
      );
    const country = params.get("country")?.toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country))
      throw new WeatherError("Choose a two-letter country code.", 400);
    const key = `locations:${country || ""}:${query.toLocaleLowerCase("en-US")}`;
    return cached(locations, key, 200, LOCATIONS_TTL, async () => {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      const queryParams = {
        name: query,
        count: "8",
        language: "en",
        format: "json",
      };
      if (country) queryParams.countryCode = country;
      url.search = new URLSearchParams(queryParams).toString();
      const data = await requestJson(
        url,
        "Location search is unavailable right now. Please try again shortly.",
      );
      if (data.results !== undefined && !Array.isArray(data.results))
        throw new WeatherError(
          "Location search returned incomplete data. Please try again.",
        );
      return {
        locations: (data.results || [])
          .slice(0, 8)
          .filter(
            (place) =>
              typeof place.name === "string" &&
              finite(place.latitude) &&
              finite(place.longitude) &&
              Math.abs(place.latitude) <= 90 &&
              Math.abs(place.longitude) <= 180,
          )
          .map((place) => ({
            name: place.name,
            country: typeof place.country === "string" ? place.country : "",
            region: typeof place.admin1 === "string" ? place.admin1 : "",
            latitude: place.latitude,
            longitude: place.longitude,
            timezone: typeof place.timezone === "string" ? place.timezone : "",
          })),
      };
    });
  }

  return { getWeather, searchLocations };
}
