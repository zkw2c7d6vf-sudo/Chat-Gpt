process.env.TZ = "America/New_York";
/** Orbit V2 browser checks. Start npm run dev before running npm run test:e2e. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.ORBIT_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const failures = [],
  errors = [],
  consoleErrors = [];
let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
  }
}
async function visible(locator) {
  await locator.waitFor({ state: "visible", timeout: 6500 });
}
function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function time(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
const calendarEvent = {
  id: "feed-event",
  title: "Calendar feed event",
  start: time(12),
  end: time(13),
  location: "Buffalo",
  allDay: false,
};
async function fixture(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
    timezoneId: "America/New_York",
  });
  if (options.storage)
    await context.addInitScript((values) => {
      if (!localStorage.getItem("orbit-test-seeded")) {
        for (const [k, v] of Object.entries(values))
          localStorage.setItem(k, JSON.stringify(v));
        localStorage.setItem("orbit-test-seeded", "true");
      }
    }, options.storage);
  await context.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        window.orbitTestRecognition = this;
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const state = {
    ics: Boolean(options.ics),
    google: Boolean(options.google),
    spotify: Boolean(options.spotify),
    ai: Boolean(options.ai),
    playing: true,
    event: calendarEvent,
    assistantBody: null,
    playbackBody: null,
    feedBody: null,
    importBody: null,
    weatherCalls: [],
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    let body = {},
      status = 200;
    if (url.pathname === "/api/connections")
      body = {
        google: {
          configured: state.google,
          connected: state.google,
          authUrl: "/api/auth/google",
        },
        spotify: {
          configured: state.spotify,
          connected: state.spotify,
          authUrl: "/api/auth/spotify",
        },
        calendar: {
          connected: state.ics || state.google,
          source: state.ics ? "ics" : state.google ? "google" : null,
          feedName: state.ics ? "Personal calendar" : "",
        },
        assistant: { configured: state.ai },
      };
    else if (url.pathname === "/api/dashboard")
      body = {
        calendar:
          state.ics || state.google
            ? [
                state.event,
                {
                  id: "all-day",
                  title: "All-day date check",
                  start: localDate(),
                  end: localDate(1),
                  allDay: true,
                  location: "",
                },
              ]
            : [],
        emails: state.google
          ? [
              {
                id: "live-mail",
                from: "Real Sender",
                subject: "Live mail check",
                snippet: "A live account summary.",
                time: time(10),
                unread: true,
                important: true,
                url: "https://mail.google.com/",
              },
            ]
          : [],
        files: state.google
          ? [
              {
                id: "live-file",
                name: "Live document check",
                type: "document",
                modifiedAt: time(9),
                owner: "You",
                url: "https://drive.google.com/",
              },
            ]
          : [],
        spotify: state.spotify
          ? {
              id: "track",
              title: "Live track check",
              artist: "Test Artist",
              album: "Test Album",
              coverUrl: "",
              isPlaying: state.playing,
              progressMs: 30000,
              durationMs: 120000,
              url: "https://open.spotify.com/",
              device: "Test device",
            }
          : null,
        errors: [],
        updatedAt: new Date().toISOString(),
      };
    else if (url.pathname === "/api/weather/locations")
      body = {
        locations: [
          {
            name: "Toronto",
            country: "Canada",
            region: "Ontario",
            latitude: 43.65,
            longitude: -79.38,
            timezone: "America/Toronto",
          },
        ],
      };
    else if (url.pathname === "/api/weather") {
      state.weatherCalls.push(Object.fromEntries(url.searchParams));
      const unit = url.searchParams.get("unit") || "fahrenheit";
      body = {
        location: {
          name: url.searchParams.get("name") || "Buffalo",
          latitude: Number(url.searchParams.get("latitude") || 42.8864),
          longitude: Number(url.searchParams.get("longitude") || -78.8784),
          timezone: "America/New_York",
        },
        unit,
        current: {
          temperature: unit === "celsius" ? 18 : 65,
          feelsLike: unit === "celsius" ? 17 : 63,
          humidity: 60,
          windSpeed: 9,
          weatherCode: 2,
          isDay: true,
          time: `${localDate()}T12:00`,
        },
        daily: Array.from({ length: 5 }, (_, i) => ({
          date: localDate(i),
          high: unit === "celsius" ? 20 : 68,
          low: unit === "celsius" ? 11 : 52,
          weatherCode: i === 2 ? 61 : 2,
          precipitationChance: 20,
        })),
        updatedAt: new Date().toISOString(),
        attribution: "Open-Meteo",
      };
    } else if (url.pathname === "/api/calendar/feed") {
      state.feedBody = request.postDataJSON();
      if (state.feedBody.url.includes("127.0.0.1")) {
        status = 400;
        body = { error: "Private network calendar URLs are not allowed." };
      } else {
        state.ics = true;
        state.event = calendarEvent;
        body = {
          connected: true,
          source: "ics",
          feedName: "Personal calendar",
        };
      }
    } else if (url.pathname === "/api/calendar/import") {
      state.importBody = request.postDataJSON();
      state.ics = true;
      state.event = { ...calendarEvent, title: "Imported calendar event" };
      body = { connected: true, source: "ics", feedName: "Imported calendar" };
    } else if (url.pathname === "/api/calendar/disconnect") {
      state.ics = false;
      body = { disconnected: true };
    } else if (url.pathname === "/api/spotify/playback") {
      state.playbackBody = request.postDataJSON();
      state.playing = state.playbackBody.playing;
      body = { playing: state.playing };
    } else if (url.pathname === "/api/assistant") {
      state.assistantBody = request.postDataJSON();
      body = {
        message:
          "A verified conversational reply using your dashboard context.",
        suggestedTasks: ["Review microphone setup"],
      };
    } else if (url.pathname === "/api/health") body = { status: "ok" };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  return { context, page, state };
}
async function settings(page) {
  await page
    .getByRole("button", { name: "Settings and connections", exact: true })
    .click();
  await visible(page.getByRole("dialog").last());
}
async function home(page) {
  await page.getByRole("button", { name: "Overview", exact: true }).click();
}
async function closeDialog(page) {
  await page.keyboard.press("Escape");
}
let main;
try {
  main = await fixture();
  const { page, state } = main;
  await check(
    "essentials appear first with no decorative hero or implicit sample data",
    async () => {
      await visible(
        page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
      );
      assert.equal(await page.locator(".hero").count(), 0);
      assert.equal(await page.getByText("SAMPLE", { exact: true }).count(), 0);
      assert.equal(await page.locator(".agenda-event").count(), 0);
      const calendar = await page.locator(".calendar-card").boundingBox();
      assert(calendar.y < 500, "Calendar is buried below decorative content");
      assert.equal(
        await page.locator(".copilot-card,.orbit-character").count(),
        0,
      );
      await visible(
        page.getByRole("heading", {
          name: /Good (morning|afternoon|evening), Joe\./,
        }),
      );
    },
  );
  await check(
    "Buffalo weather loads a five-day forecast without a key",
    async () => {
      const weather = page.getByRole("region", {
        name: "Weather",
        exact: true,
      });
      await visible(weather.getByRole("button", { name: /Buffalo/ }));
      await visible(weather.getByLabel("Five-day forecast"));
      assert(
        state.weatherCalls.some(
          (q) => q.name === "Buffalo" && q.unit === "fahrenheit",
        ),
      );
      assert.match(await weather.textContent(), /65/);
    },
  );
  await check("weather location search and units persist", async () => {
    const weather = page.getByRole("region", { name: "Weather", exact: true });
    await weather.getByRole("button", { name: /Buffalo/ }).click();
    await weather
      .getByRole("textbox", { name: "Search weather location" })
      .fill("Toronto");
    await weather.getByRole("button", { name: "Search cities" }).click();
    await weather.getByRole("button", { name: /Toronto.*Ontario/ }).click();
    await visible(weather.getByRole("button", { name: /Toronto/ }));
    await weather.getByRole("button", { name: "°C", exact: true }).click();
    await page.waitForFunction(
      () => localStorage.getItem("orbit-weather-unit") === "celsius",
    );
    await page.reload({ waitUntil: "networkidle" });
    const updated = page.getByRole("region", { name: "Weather", exact: true });
    await visible(updated.getByRole("button", { name: /Toronto/ }));
    assert.equal(
      await updated
        .getByRole("button", { name: "°C", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
  });
  await check(
    "private ICS feed connects without Google credentials",
    async () => {
      await settings(page);
      const feed = page.getByRole("region", {
        name: "Calendar feed connection",
      });
      await visible(feed);
      await feed
        .getByLabel("Private calendar feed URL")
        .fill("http://127.0.0.1/private.ics");
      await feed
        .getByRole("button", { name: "Connect calendar", exact: true })
        .click();
      await visible(feed.getByRole("alert"));
      assert.match(
        await feed.getByRole("alert").textContent(),
        /Private network/,
      );
      await feed
        .getByLabel("Private calendar feed URL")
        .fill("https://calendar.example.com/private-secret-token.ics");
      await feed
        .getByRole("button", { name: "Connect calendar", exact: true })
        .click();
      await visible(feed.getByRole("status"));
      assert.equal(
        await feed.getByLabel("Private calendar feed URL").inputValue(),
        "",
      );
      await closeDialog(page);
      await visible(page.getByText("Calendar feed event", { exact: true }));
      await visible(page.getByText("All-day date check", { exact: true }));
      assert.equal(state.google, false);
      assert.equal(
        state.feedBody.url,
        "https://calendar.example.com/private-secret-token.ics",
      );
    },
  );
  await check(
    "ICS file import updates the calendar and feed can disconnect",
    async () => {
      await settings(page);
      const feed = page.getByRole("region", {
        name: "Calendar feed connection",
      });
      await feed.getByLabel("Import ICS calendar file").setInputFiles({
        name: "calendar.ics",
        mimeType: "text/calendar",
        buffer: Buffer.from(
          "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nDTSTART:20261025T120000Z\r\nSUMMARY:Imported calendar event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
        ),
      });
      await visible(feed.getByRole("status"));
      assert.match(state.importBody.content, /BEGIN:VCALENDAR/);
      await closeDialog(page);
      await visible(page.getByText("Imported calendar event", { exact: true }));
      await settings(page);
      await page
        .getByRole("button", { name: "Disconnect feed", exact: true })
        .click();
      await visible(
        page.getByText("Calendar feed disconnected.", { exact: true }),
      );
      await closeDialog(page);
      assert.equal(await page.locator(".agenda-event").count(), 0);
    },
  );
  await check(
    "tasks persist, complete, and delete without duplicate submissions",
    async () => {
      await home(page);
      const input = page.getByRole("textbox", { name: "Add a little to-do" });
      await input.fill("Browser V2 task");
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      assert.equal(
        await page
          .locator(".task-list")
          .getByText("Browser V2 task", { exact: true })
          .count(),
        1,
      );
      await page.reload({ waitUntil: "networkidle" });
      await visible(
        page
          .locator(".task-list")
          .getByText("Browser V2 task", { exact: true }),
      );
      await page
        .getByRole("button", { name: "Complete Browser V2 task", exact: true })
        .click();
      await visible(
        page.getByRole("button", {
          name: "Uncomplete Browser V2 task",
          exact: true,
        }),
      );
      await page
        .getByRole("button", { name: "Delete Browser V2 task", exact: true })
        .click();
      assert.equal(
        await page
          .locator(".task-list")
          .getByText("Browser V2 task", { exact: true })
          .count(),
        0,
      );
    },
  );
  await check("private notes persist on reload", async () => {
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Private notes" })
      .fill("A private V2 note");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "Private notes" }).inputValue(),
      "A private V2 note",
    );
    await page.getByRole("textbox", { name: "Private notes" }).fill("");
  });
  await check("focus timer ticks, pauses, and resets", async () => {
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await page.waitForTimeout(1200);
    assert.match(
      await page.locator(".timer-ring>span").textContent(),
      /24:5[89]/,
    );
    await page
      .getByRole("button", { name: "Pause session", exact: true })
      .click();
    const paused = await page.locator(".timer-ring>span").textContent();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator(".timer-ring>span").textContent(), paused);
    await page
      .getByRole("button", { name: "Reset focus timer", exact: true })
      .click();
    assert.equal(await page.locator(".timer-ring>span").textContent(), "25:00");
  });
  await check(
    "sidebar assistant opens conversation and retains local messages",
    async () => {
      await page
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .first()
        .click();
      await visible(page.getByRole("dialog", { name: "Orbit assistant" }));
      const input = page.getByRole("textbox", { name: "Message Orbit" });
      await input.fill("Add task: Assistant V2 task");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await visible(
        page.getByText("Added “Assistant V2 task” to your little to-dos.", {
          exact: true,
        }),
      );
      await closeDialog(page);
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .first()
        .click();
      await visible(
        page.getByText("Added “Assistant V2 task” to your little to-dos.", {
          exact: true,
        }),
      );
      await closeDialog(page);
    },
  );
  await check(
    "dictation appends a draft and never automatically sends",
    async () => {
      await page
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .first()
        .click();
      const input = page.getByRole("textbox", { name: "Message Orbit" });
      await input.fill("Keep this draft.");
      const before = await page.locator(".chat-message.user").count();
      await page
        .getByRole("button", {
          name: /Use microphone|Start dictation|Dictate message/,
          exact: false,
        })
        .last()
        .click();
      await page.evaluate(() => {
        const r = window.orbitTestRecognition;
        r.onresult({
          resultIndex: 0,
          results: {
            length: 1,
            0: {
              isFinal: true,
              length: 1,
              0: { transcript: "Add this sentence." },
            },
          },
        });
      });
      assert.match(
        await input.inputValue(),
        /Keep this draft.*Add this sentence/,
      );
      assert.equal(await page.locator(".chat-message.user").count(), before);
      await page
        .getByRole("button", { name: /Stop (microphone|dictation|listening)/ })
        .last()
        .click();
      await input.fill("");
      await closeDialog(page);
    },
  );
  await check(
    "keyboard search includes project tasks and handles no matches",
    async () => {
      await page.keyboard.press("Control+k");
      await page
        .getByRole("textbox", { name: "Search everything" })
        .fill("Assistant V2 task");
      await visible(
        page.getByText("Assistant V2 task", { exact: true }).last(),
      );
      await page
        .getByRole("textbox", { name: "Search everything" })
        .fill("qzxNoMatch");
      await visible(page.getByText("No matches, just yet."));
      await closeDialog(page);
    },
  );
  await check(
    "conversation traps keyboard focus and restores the trigger",
    async () => {
      const trigger = page.getByRole("button", {
        name: "Orbit assistant",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Orbit assistant" });
      const targets = dialog.locator(
        "button:not(:disabled),input:not(:disabled),a[href]",
      );
      await targets.first().focus();
      await page.keyboard.press("Shift+Tab");
      assert(
        await targets.last().evaluate((el) => el === document.activeElement),
      );
      await page.keyboard.press("Tab");
      assert(
        await targets.first().evaluate((el) => el === document.activeElement),
      );
      await closeDialog(page);
      assert(await trigger.evaluate((el) => el === document.activeElement));
    },
  );
  await check(
    "responsive views have no horizontal overflow at four widths",
    async () => {
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const view of ["Overview", "Calendar", "Inbox", "Files"]) {
          await page.getByRole("button", { name: view, exact: true }).click();
          const size = await page.evaluate(() => ({
            viewport: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert.equal(
            size.scroll,
            size.viewport,
            `${view} overflow at ${width}: ${size.scroll}`,
          );
        }
      }
      await home(page);
    },
  );
  await check(
    "V1 task migration preserves personal tasks and seeds roadmap once",
    async () => {
      const migrated = await fixture({
        storage: {
          "orbit-tasks": [
            { id: "personal-task", title: "Keep my personal task", done: true },
            {
              id: "t1",
              title: "Make space for a little creativity",
              done: false,
            },
          ],
        },
      });
      const { page: mp } = migrated;
      const first = await mp.evaluate(() =>
        JSON.parse(localStorage.getItem("orbit-tasks")),
      );
      assert(first.some((t) => t.id === "personal-task" && t.done));
      assert(first.length > 1);
      await mp.reload({ waitUntil: "networkidle" });
      const second = await mp.evaluate(() =>
        JSON.parse(localStorage.getItem("orbit-tasks")),
      );
      assert.deepEqual(second, first);
      assert.equal(new Set(second.map((t) => t.id)).size, second.length);
      const seed = second.find(
        (task) => task.id.startsWith("v2-") && !task.done,
      );
      assert(seed, "A build roadmap seed should exist");
      await mp
        .getByRole("button", { name: `Delete ${seed.title}`, exact: true })
        .click();
      await mp.reload({ waitUntil: "networkidle" });
      const afterDelete = await mp.evaluate(() =>
        JSON.parse(localStorage.getItem("orbit-tasks")),
      );
      assert(
        !afterDelete.some((task) => task.id === seed.id),
        "Deleted roadmap task must not return on reload",
      );
      assert(
        afterDelete.some((task) => task.id === "personal-task" && task.done),
      );
      await migrated.context.close();
    },
  );
  await check(
    "connected Spotify playback and contextual AI conversation work",
    async () => {
      const live = await fixture({
        ics: true,
        spotify: true,
        google: true,
        ai: true,
      });
      const { page: lp, state: ls } = live;
      await visible(lp.getByText("Calendar feed event", { exact: true }));
      await visible(lp.getByText("Live mail check", { exact: true }));
      await visible(lp.getByText("Live document check", { exact: true }));
      await visible(lp.getByText("Live track check", { exact: true }));
      assert.equal(await lp.getByText("SAMPLE", { exact: true }).count(), 0);
      await lp
        .getByRole("button", { name: "Pause Spotify", exact: true })
        .click();
      await visible(
        lp.getByRole("button", { name: "Play Spotify", exact: true }),
      );
      assert.deepEqual(ls.playbackBody, { playing: false });
      await lp
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .first()
        .click();
      await lp
        .getByRole("textbox", { name: "Message Orbit" })
        .fill("How is my day looking?");
      await lp
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await visible(
        lp.getByText(
          "A verified conversational reply using your dashboard context.",
          { exact: true },
        ),
      );
      assert.equal(ls.assistantBody.message, "How is my day looking?");
      assert.equal(
        ls.assistantBody.context.events[0].title,
        "Calendar feed event",
      );
      assert(Array.isArray(ls.assistantBody.messages));
      await lp.keyboard.press("Escape");
      assert.equal(
        await lp
          .getByRole("button", {
            name: "Complete Review microphone setup",
            exact: true,
          })
          .count(),
        0,
      );
      await lp.getByRole("button", { name: "Approve", exact: true }).click();
      await visible(
        lp.getByRole("button", {
          name: "Complete Review microphone setup",
          exact: true,
        }),
      );
      await lp
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .click();
      await lp
        .getByRole("button", { name: "Clear conversation", exact: true })
        .click();
      assert.equal(await lp.locator(".chat-message").count(), 1);
      await visible(
        lp.getByText("Our build handoff is loaded", { exact: false }),
      );
      await live.context.close();
    },
  );
  await page.evaluate(() => {
    localStorage.removeItem("orbit-weather-location");
    localStorage.removeItem("orbit-weather-unit");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await home(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1430, 10);
  await page.screenshot({ path: "/tmp/orbit-v2-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(389, 10);
  await page.screenshot({ path: "/tmp/orbit-v2-mobile.png", fullPage: true });
  await check(
    "mobile conversation and settings stay inside the viewport",
    async () => {
      await page
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .first()
        .click();
      let box = await page
        .getByRole("dialog", { name: "Orbit assistant" })
        .boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 390);
      await closeDialog(page);
      await settings(page);
      box = await page.getByRole("dialog").last().boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 390);
      await closeDialog(page);
    },
  );
  await check("no unexpected browser runtime or console errors", async () => {
    assert.deepEqual(errors, []);
    assert.equal(
      consoleErrors.filter((message) =>
        message.includes("status of 400 (Bad Request)"),
      ).length,
      1,
      "The intentional rejected private calendar URL should be the only HTTP error",
    );
    assert.deepEqual(
      consoleErrors.filter(
        (message) => !message.includes("status of 400 (Bad Request)"),
      ),
      [],
    );
  });
  console.log(
    JSON.stringify(
      {
        passed,
        failed: failures.length,
        failures,
        runtimeErrors: errors,
        consoleErrors,
        screenshots: ["/tmp/orbit-v2-desktop.png", "/tmp/orbit-v2-mobile.png"],
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await main?.context.close();
  await browser.close();
}
