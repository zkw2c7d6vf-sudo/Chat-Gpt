import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { allWidgetLayout } from "./home-fixture.mjs";
const base = process.env.ORBIT_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const day = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const education = [
  {
    id: "edu46",
    title: "Prepare seminar",
    course: "History",
    domain: "teaching",
    kind: "lesson",
    dueDate: day(1),
    status: "active",
    notes: "PRIVATE EDUCATION SENTINEL",
    url: "https://example.org/course",
    createdAt: new Date().toISOString(),
  },
];
const tasks = [
  {
    id: "overdue46",
    title: "Renew permit",
    done: false,
    dueDate: day(-2),
    priority: "high",
    source: "you",
  },
  {
    id: "t46",
    title: "Read chapter",
    done: false,
    dueDate: day(1),
    priority: "normal",
    source: "you",
  },
  {
    id: "undated46",
    title: "Book dentist",
    done: false,
    priority: "low",
    source: "you",
  },
];
let passed = 0;
const failures = [];
mkdirSync("work/v46-validation", { recursive: true });
async function fixture(width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    timezoneId: "UTC",
    reducedMotion: "reduce",
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(
    ({ tasks, education, layout, day }) => {
      if (localStorage.getItem("v46-seed")) return;
      const seed = {
        "orbit-seed-v2": true,
        "orbit-seed-v3": true,
        "orbit-tasks": tasks,
        "orbit-education-v1": education,
        "orbit-home-scene-v2": layout,
        "orbit-finance-v1": [
          {
            id: "fin46",
            label: "Groceries",
            kind: "expense",
            amount: 12.34,
            date: `${day}T12:00:00.000Z`,
          },
          {
            id: "pay46",
            label: "Paycheck",
            kind: "income",
            amount: 100,
            date: `${day}T12:00:00.000Z`,
          },
        ],
        "orbit-shopping-searches-v1": [
          {
            id: "shop46",
            query: "Desk lamp",
            createdAt: new Date().toISOString(),
          },
        ],
        "orbit-shopping-offers-v1": [
          {
            id: "offer46",
            searchId: "shop46",
            store: "Target",
            url: "https://example.org/lamp",
            price: 20,
            shipping: 3,
            note: "Saved lamp",
          },
        ],
        "orbit-focus-history-v45": [
          {
            id: "focus46",
            minutes: 25,
            label: "Read chapter",
            completedAt: new Date().toISOString(),
          },
        ],
      };
      for (const [key, value] of Object.entries(seed))
        localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem("v46-seed", "true");
    },
    { tasks, education, layout: allWidgetLayout, day: day() },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/api/connections")
      body = {
        google: {
          configured: true,
          connected: true,
          authUrl: "/api/auth/google",
        },
        spotify: {
          configured: true,
          connected: true,
          authUrl: "/api/auth/spotify",
        },
        calendar: { connected: true, source: "google" },
        assistant: { configured: true, transcription: false },
      };
    else if (url.pathname === "/api/dashboard")
      body = {
        calendar: [
          {
            id: "cal46",
            title: "Team planning",
            start: day(1),
            end: day(2),
            allDay: true,
            location: "Office",
          },
        ],
        emails: [
          {
            id: "m46",
            from: "Alex <alex@example.org>",
            subject: "Project handoff",
            snippet: "Review the plan",
            time: new Date().toISOString(),
            unread: true,
            important: true,
            url: "https://mail.google.com/",
          },
          {
            id: "m46b",
            from: "Store",
            subject: "Receipt",
            snippet: "Order paid",
            time: new Date().toISOString(),
            unread: false,
            important: false,
          },
        ],
        files: [
          {
            id: "file46",
            name: "Project brief",
            type: "document",
            modifiedAt: new Date().toISOString(),
            owner: "Alex",
            url: "https://drive.google.com/",
          },
          {
            id: "file46b",
            name: "Budget sheet",
            type: "spreadsheet",
            modifiedAt: new Date().toISOString(),
            owner: "Joe",
            url: "https://drive.google.com/",
          },
        ],
        spotify: {
          id: "track46",
          title: "Track fixture",
          artist: "Artist",
          album: "Album",
          coverUrl: "",
          isPlaying: true,
          progressMs: 1000,
          durationMs: 120000,
          url: "https://open.spotify.com/",
          device: "Speaker",
        },
        errors: [],
        updatedAt: new Date().toISOString(),
      };
    else if (url.pathname === "/api/weather")
      body = {
        location: { name: "Buffalo", latitude: 42, longitude: -78 },
        unit: "fahrenheit",
        current: {
          temperature: 60,
          feelsLike: 58,
          humidity: 60,
          windSpeed: 5,
          weatherCode: 3,
          isDay: true,
          time: new Date().toISOString(),
        },
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: day(i),
          high: 60 + i,
          low: 40 + i,
          weatherCode: 3,
          precipitationChance: 10 + i,
        })),
        updatedAt: new Date().toISOString(),
        attribution: "Open-Meteo",
      };
    else if (url.pathname === "/api/shopping/feed")
      body = {
        configured: false,
        provider: "eBay",
        items: [],
        message: "Not configured",
      };
    else if (url.pathname.startsWith("/api/media/")) body = [];
    else if (url.pathname.startsWith("/api/spotify/")) {
      requests.push(url.pathname);
      await new Promise((r) => setTimeout(r, 150));
      body = { ok: true };
    } else if (url.pathname === "/api/assistant") {
      requests.push(route.request().postData());
      body = { message: "Review your open tasks.", suggestedTasks: [] };
    }
    await route.fulfill({ json: body });
  });
  await page.goto(base);
  await page
    .getByRole("button", { name: "Search Orbit", exact: true })
    .waitFor();
  return { context, page, errors, requests };
}
async function run(name, fn, width) {
  const f = await fixture(width);
  try {
    await fn(f);
    assert.deepEqual(f.errors, []);
    passed++;
    console.log("PASS", name);
  } catch (error) {
    failures.push(`${name}: ${error.stack}`);
    await f.page.screenshot({
      path: `work/v46-validation/failure-${failures.length}.png`,
    });
    console.error("FAIL", name, error.message);
  } finally {
    await f.context.close();
  }
}
const nav = (page, name) =>
  page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
const download = async (page, trigger) => {
  const event = page.waitForEvent("download");
  await trigger();
  const item = await event;
  const path = await item.path();
  return readFileSync(path, "utf8");
};
await run(
  "finance edit, filtered cent totals, export, delete undo and reload",
  async ({ page }) => {
    await nav(page, "Finances");
    const panel = page.getByRole("region", { name: "Finances", exact: true });
    await panel.getByRole("button", { name: "Edit finance Groceries" }).click();
    await page.getByLabel("Amount", { exact: true }).fill("15.67");
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    assert((await panel.locator("header").innerText()).includes("$84.33"));
    await page.getByLabel("Search finances").fill("Groceries");
    assert.equal(await panel.locator(".finance-list article").count(), 1);
    const csv = await download(page, () =>
      page.getByRole("button", { name: "Export CSV", exact: true }).click(),
    );
    assert(csv.includes("15.67"));
    assert(!csv.includes("Paycheck"));
    await page.getByRole("button", { name: "Delete Groceries" }).click();
    await panel.getByRole("button", { name: "Undo", exact: true }).click();
    assert.equal(await panel.locator(".finance-list article").count(), 1);
    await page.reload();
    await nav(page, "Finances");
    assert(
      (await page.locator(".finance-list").innerText()).includes("$15.67"),
    );
  },
);
await run(
  "planner finds sources and moves overdue task into today",
  async ({ page }) => {
    await nav(page, "Planner");
    const panel = page.getByRole("region", { name: "Weekly planner" });
    await panel.getByText("Overdue tasks · 1", { exact: true }).click();
    await panel.getByRole("button", { name: "Move Renew permit to today" }).click();
    assert.equal(
      await panel.getByText("Overdue tasks · 1", { exact: true }).count(),
      0,
    );
    await page.getByLabel("Planner source").selectOption("education");
    assert.equal(await panel.locator(".planner-event").count(), 0);
    assert.equal(await panel.locator(".planner-education").count(), 1);
    await page.getByLabel("Search planner").fill("no such item");
    assert.equal(await panel.locator(".planner-education").count(), 0);
  },
);
await run(
  "tasks search, CSV, due sorting and notes download",
  async ({ page }) => {
    await nav(page, "Planner");
    const panel = page.getByRole("region", { name: "Tasks and notes" });
    await page.getByLabel("Search tasks").fill("Read chapter");
    assert.equal(await panel.locator(".task-row").count(), 1);
    await page.getByLabel("Sort tasks").selectOption("date");
    const csv = await download(page, () =>
      panel.getByRole("button", { name: "Export CSV", exact: true }).click(),
    );
    assert(csv.includes("Read chapter"));
    assert(!csv.includes("Renew permit"));
    await panel.getByRole("button", { name: "Notes", exact: true }).click();
    await page.getByLabel("Private notes").fill("Remember the library book");
    const note = await download(page, () =>
      panel.getByRole("button", { name: "Download notes" }).click(),
    );
    assert.equal(note, "Remember the library book");
  },
);
await run(
  "education course filter, duplicate draft, CSV and local search",
  async ({ page }) => {
    await nav(page, "Education Center");
    await page.getByLabel("Filter by course").selectOption("History");
    await page
      .getByRole("button", { name: "Duplicate education Prepare seminar" })
      .click();
    await page
      .getByLabel("Education title", { exact: true })
      .fill("Second seminar");
    await page.getByRole("button", { name: "Save responsibility" }).click();
    assert.equal(await page.locator(".education-record").count(), 2);
    const csv = await download(page, () =>
      page.getByRole("button", { name: "Export CSV", exact: true }).click(),
    );
    assert(csv.includes("Second seminar"));
    await page
      .getByRole("button", { name: "Search Orbit", exact: true })
      .click();
    await page.getByLabel("Search everything").fill("Second seminar");
    assert.equal(
      await page
        .locator(".search-results")
        .getByText("Second seminar", { exact: true })
        .count(),
      1,
    );
  },
);
await run(
  "inbox search, unread marker recovery and email-to-task duplicate protection",
  async ({ page }) => {
    await nav(page, "Inbox");
    await page.getByLabel("Search inbox").fill("Alex");
    await page.getByLabel("Unread only").check();
    assert.equal(await page.locator(".mail-item").count(), 1);
    await page.locator(".mail-item").click();
    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: "Create task from email" }).click();
    await modal.getByRole("button", { name: "Create task from email" }).click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("orbit-tasks")).filter(
            (t) => t.title === "Project handoff",
          ).length,
      ),
      1,
    );
    await modal
      .getByRole("button", { name: "Reset Orbit read marker" })
      .click();
    assert.equal(await page.locator(".mail-item").count(), 1);
    await page.getByRole("button", { name: "Mark matching read" }).click();
    assert.equal(await page.locator(".mail-item").count(), 0);
  },
);
await run("Drive files filter, search, sort and clear", async ({ page }) => {
  await nav(page, "Files");
  await page.getByLabel("Filter Drive files").selectOption("spreadsheet");
  assert.equal(await page.locator(".file-tile").count(), 1);
  assert(
    (await page.locator(".file-tile").innerText()).includes("Budget sheet"),
  );
  await page.getByLabel("Search Drive files").fill("missing");
  await page.getByRole("button", { name: "Clear file filters" }).click();
  await page.getByLabel("Sort Drive files").selectOption("name");
  assert.equal(
    await page.locator(".file-tile").first().locator(".file-name").innerText(),
    "Budget sheet",
  );
});
await run(
  "Home hide all, undo and widget search retain existing geometry",
  async ({ page }) => {
    const count = await page.locator(".oi-window").count();
    await page.getByRole("button", { name: "Widgets", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Manage widgets" });
    await page.getByLabel("Search widgets").fill("weather");
    assert.equal(await panel.locator(".oi-widget-entry").count(), 1);
    await panel.getByRole("button", { name: "Hide all panels" }).click();
    assert.equal(await page.locator(".oi-window").count(), 0);
    await panel.getByRole("button", { name: "Undo layout change" }).click();
    assert.equal(await page.locator(".oi-window").count(), count);
  },
);
await run(
  "weather expanded day details use the existing forecast",
  async ({ page }) => {
    const panel = page.locator('.oi-window[data-widget-id="weather"]');
    await panel
      .getByRole("button", { name: "Maximize Weather · 5 days", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: `Forecast details for ${day(2)}`,
        exact: true,
      })
      .click();
    assert(
      (await panel.locator(".forecast-detail").innerText()).includes(
        "12% chance of precipitation",
      ),
    );
  },
);
await run(
  "Focus exports actual completed sessions and shows seven day total",
  async ({ page }) => {
    const panel = page.locator('.oi-window[data-widget-id="focus"]');
    await panel
      .getByRole("button", { name: "Maximize Focus session", exact: true })
      .click();
    assert(
      (await panel.locator(".focus-stats").innerText()).includes(
        "25 min in 7 days",
      ),
    );
    await panel.getByText("Recent sessions", { exact: true }).click();
    const csv = await download(page, () =>
      page.getByRole("button", { name: "Export sessions CSV" }).click(),
    );
    assert(csv.includes("Read chapter"));
  },
);
await run(
  "Spotify ignores duplicate playback requests while a command is pending",
  async ({ page, requests }) => {
    const panel = page.locator('.oi-window[data-widget-id="spotify"]');
    await panel
      .getByRole("button", { name: "Maximize Spotify", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Previous track", exact: true })
      .dblclick();
    await page.waitForTimeout(300);
    assert.equal(
      requests.filter((x) => x === "/api/spotify/previous").length,
      1,
    );
  },
);
await run(
  "Shopping board search, removal undo and export preserve prices",
  async ({ page }) => {
    await nav(page, "Shopping Scout");
    await page.getByLabel("Search saved comparisons").fill("Desk");
    await page
      .getByRole("button", { name: "Remove Desk lamp", exact: true })
      .click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    const csv = await download(page, () =>
      page.getByRole("button", { name: "Export comparisons CSV" }).click(),
    );
    assert(csv.includes("Desk lamp"));
    assert(csv.includes('"23"'));
    assert.equal(await page.locator(".shopping-saved article").count(), 1);
  },
);
await run(
  "Media watched, size and duration filters use local metadata",
  async ({ page }) => {
    await page.evaluate(async () => {
      const { addMedia, updateMedia } = await import("/src/media/store.ts");
      for (const [name, size, duration, watched] of [
        ["Short", 20, 60, false],
        ["Long", 100, 120, true],
      ]) {
        const item = await addMedia(
          new File([new Uint8Array(size)], `${name}.webm`, {
            type: "video/webm",
          }),
          "movies",
        );
        await updateMedia(item.id, { duration, watched });
      }
    });
    await nav(page, "Media Center");
    await page.getByLabel("Sort media").selectOption("size");
    assert(
      (await page.locator(".media-item").first().innerText()).includes("Long"),
    );
    await page.getByLabel("Filter media").selectOption("watched");
    assert.equal(await page.locator(".media-item").count(), 1);
    await page.getByRole("button", { name: "Clear library filters" }).click();
    await page.getByLabel("Sort media").selectOption("duration");
    assert.equal(await page.locator(".media-item").count(), 2);
  },
);
await run(
  "File Studio copies output and invalid image cannot reconvert a previous file",
  async ({ page }) => {
    await nav(page, "File Studio");
    await page.getByRole("button", { name: "JSON & CSV" }).click();
    await page.getByLabel("File Studio source text").fill('{"a":1}');
    await page
      .getByRole("button", { name: "Convert text", exact: true })
      .click();
    await page.getByRole("button", { name: "Copy output" }).click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      '{\n  "a": 1\n}',
    );
    await page.getByRole("button", { name: "Images", exact: true }).click();
    await page
      .getByLabel("File Studio input")
      .setInputFiles({
        name: "bad.png",
        mimeType: "text/plain",
        buffer: Buffer.from("bad"),
      });
    assert(
      await page
        .getByRole("button", { name: "Convert image", exact: true })
        .isDisabled(),
    );
  },
);
await run(
  "Backup inventory, last export and new records round trip",
  async ({ page }) => {
    await page.getByRole("button", { name: "Profile and connections" }).click();
    assert(
      (await page.getByLabel("Backup inventory").innerText()).includes(
        "1 education records",
      ),
    );
    const text = await download(page, () =>
      page
        .getByRole("button", { name: "Export dashboard", exact: true })
        .click(),
    );
    const backup = JSON.parse(text);
    assert.equal(backup.data["orbit-finance-v1"].length, 2);
    assert.equal(backup.data["orbit-education-v1"].length, 1);
    assert(await page.getByText(/Last export prepared:/).count());
  },
);
await run(
  "Assistant exports conversation and excludes education from API context",
  async ({ page, requests }) => {
    await page
      .getByRole("button", { name: "Orbit assistant", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Orbit assistant" });
    await dialog.getByLabel("Message Orbit").fill("Help me plan the week");
    await dialog.getByRole("button", { name: "Send message" }).click();
    await dialog
      .getByText("Review your open tasks.", { exact: true })
      .waitFor();
    const transcript = await download(page, () =>
      dialog.getByRole("button", { name: "Download conversation" }).click(),
    );
    assert(transcript.includes("Help me plan the week"));
    assert(!requests.join(" ").includes("PRIVATE EDUCATION SENTINEL"));
  },
);
await run(
  "Every module fits a narrow mobile viewport",
  async ({ page }) => {
    for (const name of [
      "Planner",
      "Education Center",
      "File Studio",
      "Inbox",
      "Files",
      "Media Center",
      "Shopping Scout",
      "Finances",
    ]) {
      await nav(page, name);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert(!overflow, `${name} overflows mobile`);
    }
  },
  390,
);
await browser.close();
console.log(`${passed} passed; ${failures.length} failed`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
