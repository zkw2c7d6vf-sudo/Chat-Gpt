import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  timezoneId: "America/New_York",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/media/search**", (route) =>
  route.fulfill({
    json: [
      {
        id: 42,
        name: "Orbit Test Show",
        type: "Scripted",
        summary: "A catalog result.",
        image: "https://static.tvmaze.com/show.jpg",
        rating: 8.4,
        genres: [],
        premiered: null,
        status: null,
        imdb: "https://www.imdb.com/title/tt1234567/",
        official: null,
      },
    ],
  }),
);
await page.route("**/api/media/popular**", (route) =>
  route.fulfill({
    json: [
      {
        id: 42,
        name: "Orbit Test Show",
        type: "Scripted",
        summary: "A catalog result.",
        image: "https://static.tvmaze.com/show.jpg",
        rating: 8.4,
        genres: [],
        premiered: null,
        status: null,
        imdb: "https://www.imdb.com/title/tt1234567/",
        official: null,
      },
    ],
  }),
);
await page.route("**/api/media/show/42", (route) =>
  route.fulfill({
    json: {
      show: {
        id: 42,
        name: "Orbit Test Show",
        type: "Scripted",
        summary: "A catalog result.",
        image: "https://static.tvmaze.com/show.jpg",
        rating: 8.4,
        genres: [],
        premiered: null,
        status: null,
        imdb: "https://www.imdb.com/title/tt1234567/",
        official: null,
      },
      cast: [
        {
          name: "Orbit Actor",
          character: "The Pilot",
          image: null,
          imdb: "https://www.imdb.com/name/nm1234567/",
        },
      ],
    },
  }),
);
await page.route("**/api/media/ratings**", (route) =>
  route.fulfill({
    json: {
      available: false,
      reason: "Add OMDB_API_KEY to enable Rotten Tomatoes scores.",
    },
  }),
);
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  await page.goto(`${(process.env.ORBIT_URL || "http://127.0.0.1:5173").replace(/\/$/, "")}/?classic-home=1`, {
    waitUntil: "networkidle",
  });
  await check("media discovery shows cast and IMDb links", async () => {
    await page
      .getByRole("button", { name: "Media Center", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search shows and movies" })
      .fill("Orbit Test");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page
      .getByRole("button", { name: /Orbit Test Show/ })
      .last()
      .click();
    await page.getByText("Orbit Actor", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("link", { name: /Open on IMDb/ }).count(),
      1,
    );
    assert.equal(await page.getByText(/Add OMDB_API_KEY/).count(), 1);
  });
  await check("YouTube player validates and embeds a saved video", async () => {
    await page
      .getByRole("textbox", { name: "YouTube link" })
      .fill("https://youtu.be/dQw4w9WgXcQ");
    await page
      .getByRole("button", { name: "Play", exact: true })
      .last()
      .click();
    assert.equal(
      await page.locator('iframe[title="YouTube player"]').count(),
      1,
    );
    await page.getByRole("button", { name: "Save YouTube video" }).click();
    await page.getByText("Saved videos", { exact: true }).waitFor();
  });
  await check("rain focus mode stays inside the focus card", async () => {
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Focus duration" })
      .selectOption("custom");
    await page
      .getByRole("spinbutton", { name: "Custom focus minutes" })
      .fill("7");
    assert.equal(await page.locator(".timer-ring>span").textContent(), "07:00");
    await page
      .getByRole("combobox", { name: "Focus duration" })
      .selectOption("25");
    await page
      .getByRole("combobox", { name: "Focus sound" })
      .selectOption("rain");
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    assert.equal(await page.locator(".focus-card .rain-box").count(), 1);
    assert.equal(
      await page.locator(".focus-card .rain-box.rain-active").count(),
      1,
    );
  });
  assert.deepEqual(errors, []);
  console.log(`${passed} v4 browser checks passed.`);
} finally {
  await browser.close();
}
