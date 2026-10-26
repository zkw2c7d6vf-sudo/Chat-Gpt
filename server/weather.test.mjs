import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherService } from "./weather.mjs";

function forecast() {
  return {
    timezone: "America/New_York",
    current: {
      temperature_2m: 51,
      apparent_temperature: 47,
      relative_humidity_2m: 72,
      wind_speed_10m: 9,
      weather_code: 3,
      is_day: 1,
      time: "2026-10-25T14:00",
    },
    daily: {
      time: ["2026-10-25", "2026-10-26"],
      temperature_2m_max: [54, 58],
      temperature_2m_min: [43, 40],
      precipitation_probability_max: [20, 5],
      weather_code: [3, 1],
    },
  };
}

test("weather defaults to live Buffalo Fahrenheit data and seven-day request", async () => {
  let requested;
  const service = createWeatherService({
    fetch: async (url) => {
      requested = new URL(url);
      return Response.json(forecast());
    },
  });
  const weather = await service.getWeather();
  assert.equal(weather.location.name, "Buffalo");
  assert.equal(weather.location.latitude, 42.8864);
  assert.equal(weather.location.longitude, -78.8784);
  assert.equal(weather.location.timezone, "America/New_York");
  assert.equal(weather.unit, "fahrenheit");
  assert.equal(weather.current.temperature, 51);
  assert.equal(weather.current.feelsLike, 47);
  assert.equal(weather.current.isDay, true);
  assert.deepEqual(weather.daily[0], {
    date: "2026-10-25",
    high: 54,
    low: 43,
    weatherCode: 3,
    precipitationChance: 20,
  });
  assert.equal(weather.attribution, "Open-Meteo");
  assert.equal(requested.hostname, "api.open-meteo.com");
  assert.equal(requested.searchParams.get("forecast_days"), "7");
  assert.equal(requested.searchParams.get("temperature_unit"), "fahrenheit");
  assert.equal(requested.searchParams.get("wind_speed_unit"), "mph");
  assert.equal(requested.searchParams.get("timezone"), "auto");
  assert.ok(Date.parse(weather.updatedAt));
});

test("custom weather locations and Celsius use validated coordinates", async () => {
  let requested;
  const service = createWeatherService({
    fetch: async (url) => {
      requested = new URL(url);
      return Response.json(forecast());
    },
  });
  const weather = await service.getWeather(
    new URLSearchParams({
      latitude: "51.5074",
      longitude: "-0.1278",
      unit: "celsius",
      name: "London",
    }),
  );
  assert.equal(weather.location.name, "London");
  assert.equal(weather.location.latitude, 51.5074);
  assert.equal(weather.unit, "celsius");
  assert.equal(requested.searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(requested.searchParams.get("latitude"), "51.5074");
});

test("invalid weather requests do not make upstream requests", async () => {
  const service = createWeatherService({
    fetch: async () => {
      assert.fail("Should not fetch invalid input");
    },
  });
  for (const params of [
    { latitude: "91" },
    { latitude: "" },
    { longitude: "-181" },
    { longitude: "Infinity" },
    { unit: "kelvin" },
    { name: "x".repeat(121) },
  ]) {
    await assert.rejects(
      service.getWeather(new URLSearchParams(params)),
      (error) => error.status === 400,
    );
  }
});

test("weather caching shares in-flight requests but keeps location labels independent", async () => {
  let count = 0;
  let clock = Date.now();
  const service = createWeatherService({
    now: () => clock,
    fetch: async () => {
      count++;
      return Response.json(forecast());
    },
  });
  const [first, second] = await Promise.all([
    service.getWeather(),
    service.getWeather(new URLSearchParams({ name: "Home" })),
  ]);
  assert.equal(count, 1);
  assert.equal(first.location.name, "Buffalo");
  assert.equal(second.location.name, "Home");
  clock += 5 * 60 * 1000 + 1;
  await service.getWeather();
  assert.equal(count, 2);
});

test("weather failures and incomplete data are explicit and never fabricated", async () => {
  for (const fetcher of [
    async () => {
      throw new Error("private details");
    },
    async () => new Response("bad", { status: 429 }),
    async () => Response.json({ error: true }),
    async () => Response.json({}),
    async () => {
      const data = forecast();
      data.daily.temperature_2m_min = [];
      return Response.json(data);
    },
  ]) {
    const service = createWeatherService({ fetch: fetcher });
    await assert.rejects(
      service.getWeather(),
      (error) =>
        error.status === 502 && !error.message.includes("private details"),
    );
  }
});

test("location search returns normalized results and caches names case-insensitively", async () => {
  let count = 0;
  let requested;
  const service = createWeatherService({
    fetch: async (url) => {
      count++;
      requested = new URL(url);
      return Response.json({
        results: [
          {
            name: "Buffalo",
            country: "United States",
            admin1: "New York",
            latitude: 42.8864,
            longitude: -78.8784,
            timezone: "America/New_York",
          },
          { name: "Invalid", latitude: 1000, longitude: 0 },
        ],
      });
    },
  });
  const results = await service.searchLocations(
    new URLSearchParams({ q: "Buffalo", country: "us" }),
  );
  assert.deepEqual(results.locations, [
    {
      name: "Buffalo",
      country: "United States",
      region: "New York",
      latitude: 42.8864,
      longitude: -78.8784,
      timezone: "America/New_York",
    },
  ]);
  await service.searchLocations(
    new URLSearchParams({ q: "BUFFALO", country: "US" }),
  );
  assert.equal(count, 1);
  assert.equal(requested.hostname, "geocoding-api.open-meteo.com");
  assert.equal(requested.searchParams.get("countryCode"), "US");
  assert.equal(requested.searchParams.get("count"), "8");
});

test("location search handles no matches and rejects invalid queries", async () => {
  const service = createWeatherService({
    fetch: async () => Response.json({ generationtime_ms: 1 }),
  });
  assert.deepEqual(
    await service.searchLocations(
      new URLSearchParams({ q: "NoSuchPlaceHere" }),
    ),
    { locations: [] },
  );
  for (const params of [
    {},
    { q: "x" },
    { q: "x".repeat(101) },
    { q: "Buffalo", country: "USA" },
  ])
    await assert.rejects(
      service.searchLocations(new URLSearchParams(params)),
      (error) => error.status === 400,
    );
});

test("location search outage returns a safe error and can recover", async () => {
  let count = 0;
  const service = createWeatherService({
    fetch: async () => {
      count++;
      if (count === 1) throw new Error("secret upstream detail");
      return Response.json({ results: [] });
    },
  });
  await assert.rejects(
    service.searchLocations(new URLSearchParams({ q: "Buffalo" })),
    (error) => error.status === 502 && !error.message.includes("secret"),
  );
  assert.deepEqual(
    await service.searchLocations(new URLSearchParams({ q: "Buffalo" })),
    { locations: [] },
  );
  assert.equal(count, 2);
});
