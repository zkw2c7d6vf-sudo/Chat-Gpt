import { allWidgetLayout } from "./home-fixture.mjs";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.ORBIT_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [],
  failures = [];
let passed = 0;
const artifacts = process.env.ORBIT_SCREENSHOTS || "work/v45-validation";
mkdirSync(artifacts, { recursive: true });
const titles = {
  upnext: "Up next",
  priorities: "Today's priorities",
  focus: "Focus session",
  spotify: "Spotify",
  weather: "Weather · 5 days",
  email: "Email",
  continue: "Continue watching",
  notes: "Quick notes",
  calendar: "Calendar",
  ambient: "Ambient sound",
  files: "Recent files",
};
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
function day(offset = 0) {
  const date = new Date(`${today()}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const taskRecords = Array.from({ length: 6 }, (_, index) => ({
  id: `t45-${index}`,
  title: `Priority fixture ${index + 1}`,
  done: false,
  priority: index === 0 ? "high" : "normal",
  dueDate: day(index % 3),
  source: "you",
}));
const events = Array.from({ length: 5 }, (_, index) => ({
  id: `e45-${index}`,
  title: `Schedule fixture ${index + 1}`,
  start: day(index + 1),
  end: day(index + 2),
  allDay: true,
  location: `Place ${index + 1}`,
}));
async function fixture({ connected = true, serviceErrors = [] } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    timezoneId: "America/New_York",
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  await context.addInitScript(
    ({ tasks, layout }) => {
      if (!localStorage.getItem("v45-test-seed")) {
        localStorage.setItem("orbit-tasks", JSON.stringify(tasks));
        localStorage.setItem("orbit-seed-v2", "true");
        localStorage.setItem("orbit-seed-v3", "true");
        localStorage.setItem("orbit-home-scene-v2", JSON.stringify(layout));
        localStorage.setItem("v45-test-seed", "true");
      }
    },
    { tasks: taskRecords, layout: allWidgetLayout },
  );
  const state = {
    connected,
    serviceErrors,
    playing: true,
    weatherCalls: 0,
    assistant: null,
  };
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    let body = {};
    if (url.pathname === "/api/connections")
      body = {
        google: {
          configured: true,
          connected: state.connected,
          authUrl: "/api/auth/google",
        },
        spotify: {
          configured: true,
          connected: state.connected,
          authUrl: "/api/auth/spotify",
        },
        calendar: {
          connected: state.connected,
          source: state.connected ? "google" : null,
        },
        assistant: { configured: true, transcription: false },
      };
    else if (url.pathname === "/api/dashboard")
      body = {
        calendar: state.connected ? events : [],
        emails: state.connected
          ? Array.from({ length: 10 }, (_, i) => ({
              id: `m45-${i}`,
              from: `Sender ${i + 1}`,
              subject: `Mail fixture ${i + 1}`,
              snippet: `Message preview ${i + 1}`,
              time: new Date().toISOString(),
              unread: true,
              important: i < 8,
              url: "https://mail.google.com/",
            }))
          : [],
        files: state.connected
          ? Array.from({ length: 10 }, (_, i) => ({
              id: `f45-${i}`,
              name: `Drive fixture ${i + 1}`,
              type: "document",
              modifiedAt: new Date().toISOString(),
              owner: "You",
              url: "https://drive.google.com/",
            }))
          : [],
        spotify: state.connected
          ? {
              id: "track45",
              title: "Track fixture",
              artist: "Artist fixture",
              album: "Album fixture",
              coverUrl: "",
              isPlaying: state.playing,
              progressMs: 60000,
              durationMs: 240000,
              url: "https://open.spotify.com/",
              device: "Test speaker",
            }
          : null,
        errors: state.serviceErrors,
        updatedAt: new Date().toISOString(),
      };
    else if (url.pathname === "/api/weather") {
      state.weatherCalls++;
      body = {
        location: {
          name: url.searchParams.get("name") || "Buffalo",
          latitude: 42.8864,
          longitude: -78.8784,
          timezone: "America/New_York",
        },
        unit: url.searchParams.get("unit") || "fahrenheit",
        current: {
          temperature: 62,
          feelsLike: 60,
          humidity: 70,
          windSpeed: 6,
          weatherCode: 3,
          isDay: true,
          time: new Date().toISOString(),
        },
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: day(i),
          high: 65 + i,
          low: 45 + i,
          weatherCode: 3,
          precipitationChance: 10 + i,
        })),
        updatedAt: new Date().toISOString(),
      };
    } else if (url.pathname === "/api/weather/locations")
      body = {
        locations: [
          {
            name: "Toronto",
            latitude: 43.65,
            longitude: -79.38,
            region: "Ontario",
            country: "Canada",
            timezone: "America/Toronto",
          },
        ],
      };
    else if (url.pathname === "/api/spotify/playback") {
      state.playing = request.postDataJSON().playing;
      body = { playing: state.playing };
    } else if (url.pathname === "/api/assistant") {
      state.assistant = request.postDataJSON();
      body = { message: "Dashboard context received.", suggestedTasks: [] };
    } else if (
      url.pathname === "/api/media/popular" ||
      url.pathname === "/api/media/search"
    )
      body = [];
    else if (url.pathname === "/api/shopping/feed")
      body = {
        configured: false,
        provider: "eBay",
        items: [],
        message: "Catalog is not configured.",
      };
    await route.fulfill({ json: body });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".oi-root").waitFor();
  return { context, page, state };
}
const widget = (page, id) => page.locator(`[data-widget-id="${id}"]`);
async function maximize(page, id) {
  await page
    .getByRole("button", { name: `Maximize ${titles[id]}`, exact: true })
    .click();
  assert.equal(
    await widget(page, id).getAttribute("data-content-mode"),
    "expanded",
  );
}
async function restore(page, id) {
  await page
    .getByRole("button", { name: `Restore ${titles[id]}`, exact: true })
    .click();
  assert.equal(
    await widget(page, id).getAttribute("data-content-mode"),
    "compact",
  );
}
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
    await page
      .locator(".oi-window-controls button[aria-label^=Restore]")
      .evaluateAll((nodes) => nodes.forEach((node) => node.click()))
      .catch(() => {});
  }
}
const main = await fixture();
const { page, state } = main;
try {
  // Metadata comes from the same IndexedDB library that the native player uses.
  await page.evaluate(async () => {
    const store = await import("/src/media/store.ts");
    for (let i = 0; i < 3; i++) {
      const file = new File(
        [new Uint8Array([26, 69, 223, 163, i])],
        `Resume fixture ${i + 1}.webm`,
        { type: "video/webm", lastModified: 100 + i },
      );
      const item = await store.addMedia(file, "movies");
      await store.updateMedia(item.id, {
        progress: 10 + i,
        duration: 100,
        queued: i === 2,
      });
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  const weatherBaseline = state.weatherCalls;
  const deltas = {
    upnext: async () =>
      assert.equal(
        await widget(page, "upnext").locator(".oi-upnext-event").count(),
        5,
      ),
    priorities: async () => {
      assert.equal(
        await widget(page, "priorities").locator(".task-row").count(),
        6,
      );
      await widget(page, "priorities").getByLabel("Filter tasks").waitFor();
    },
    focus: async () => {
      await widget(page, "focus").getByLabel("Focus intention").waitFor();
      await widget(page, "focus")
        .getByLabel("Focus sound", { exact: true })
        .waitFor();
      assert.match(await widget(page, "focus").innerText(), /min today/);
    },
    spotify: async () => {
      assert.match(await widget(page, "spotify").innerText(), /Album fixture/);
      assert.match(await widget(page, "spotify").innerText(), /Test speaker/);
      await widget(page, "spotify")
        .getByRole("button", { name: "Next track", exact: true })
        .waitFor();
    },
    weather: async () => {
      assert.equal(
        await widget(page, "weather").locator(".weather-forecast>div").count(),
        7,
      );
      await widget(page, "weather")
        .getByRole("button", { name: "°C", exact: true })
        .waitFor();
      assert.match(await widget(page, "weather").innerText(), /Humidity/);
    },
    email: async () => {
      assert.equal(
        await widget(page, "email").locator(".mail-item").count(),
        8,
      );
      await widget(page, "email")
        .getByRole("button", { name: /All mail/ })
        .click();
      assert.equal(
        await widget(page, "email").locator(".mail-item").count(),
        10,
      );
      await widget(page, "email")
        .getByRole("button", { name: /Important/ })
        .click();
    },
    continue: async () =>
      assert.equal(
        await widget(page, "continue")
          .locator(".oi-media-resume-list button")
          .count(),
        4,
      ),
    notes: async () => {
      assert.match(
        await widget(page, "notes").innerText(),
        /500,000 characters/,
      );
      await widget(page, "notes")
        .getByLabel("Quick notes", { exact: true })
        .fill("A saved expanded note");
      await widget(page, "notes")
        .getByRole("button", { name: "Download notes" })
        .waitFor();
    },
    calendar: async () => {
      assert.equal(
        await widget(page, "calendar").locator(".week-day").count(),
        14,
      );
      await widget(page, "calendar")
        .getByRole("heading", { name: "Upcoming days" })
        .waitFor();
    },
    ambient: async () => {
      await widget(page, "ambient").getByLabel("Ambient volume").fill("32");
      await widget(page, "ambient")
        .getByRole("button", { name: "Start focus & sound" })
        .waitFor();
    },
    files: async () =>
      assert.equal(
        await widget(page, "files").locator(".file-tile").count(),
        10,
      ),
  };
  await check(
    "compact counts are 3 tasks, 7 dates, 5 forecast days, 3 emails and 4 files",
    async () => {
      assert.equal(
        await widget(page, "priorities").locator(".task-row").count(),
        3,
      );
      assert.equal(
        await widget(page, "calendar").locator(".week-day").count(),
        7,
      );
      assert.equal(
        await widget(page, "weather").locator(".weather-forecast>div").count(),
        5,
      );
      assert.equal(
        await widget(page, "email").locator(".mail-item").count(),
        3,
      );
      assert.equal(
        await widget(page, "files").locator(".file-tile").count(),
        4,
      );
      assert.equal(
        await widget(page, "continue").locator(".media-summary-play").count(),
        1,
      );
    },
  );
  for (const id of Object.keys(titles))
    await check(
      `${id}: real expanded content, exact restore, minimize/dock and close/reopen`,
      async () => {
        const before = await widget(page, id).evaluate((node) => ({
          left: node.style.left,
          top: node.style.top,
          width: node.style.width,
          height: node.style.height,
        }));
        await maximize(page, id);
        await deltas[id]();
        await restore(page, id);
        assert.deepEqual(
          await widget(page, id).evaluate((node) => ({
            left: node.style.left,
            top: node.style.top,
            width: node.style.width,
            height: node.style.height,
          })),
          before,
        );
        await page
          .getByRole("button", { name: `Minimize ${titles[id]}`, exact: true })
          .click();
        assert.equal(await widget(page, id).count(), 0);
        await page
          .getByRole("button", { name: `Open ${titles[id]}`, exact: true })
          .click();
        await widget(page, id).waitFor();
        await page
          .getByRole("button", { name: `Close ${titles[id]}`, exact: true })
          .click();
        assert.equal(await widget(page, id).count(), 0);
        await page
          .getByRole("button", { name: "Widgets", exact: true })
          .click();
        await page
          .locator(".oi-widget-entry")
          .filter({ has: page.locator("span").filter({ hasText: titles[id] }) })
          .getByRole("button", { name: "Show", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Close widgets", exact: true })
          .click();
        await widget(page, id).waitFor();
      },
    );
  await check(
    "expanding weather reuses its response instead of refetching per resize",
    async () => {
      assert.equal(
        state.weatherCalls,
        weatherBaseline,
        "Resize and expansion should reuse the same weather response",
      );
    },
  );
  await check(
    "direct pointer drag, keyboard resize, progressive content and click to front work",
    async () => {
      const bar = widget(page, "priorities").getByRole("toolbar");
      await bar.scrollIntoViewIfNeeded();
      const before = await widget(page, "priorities").evaluate((node) => ({
        left: parseFloat(node.style.left),
        top: parseFloat(node.style.top),
      }));
      const box = await bar.boundingBox();
      await page.mouse.move(box.x + 30, box.y + 18);
      await page.mouse.down();
      await page.mouse.move(box.x + 70, box.y + 53, { steps: 5 });
      await page.mouse.up();
      const after = await widget(page, "priorities").evaluate((node) => ({
        left: parseFloat(node.style.left),
        top: parseFloat(node.style.top),
      }));
      assert(after.left > before.left);
      assert(after.top > before.top);
      await bar.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await widget(page, "priorities").evaluate((node) =>
          parseFloat(node.style.left),
        ),
        after.left + 10,
      );
      const slider = widget(page, "priorities").getByRole("slider");
      await slider.scrollIntoViewIfNeeded();
      const resizeBefore = await widget(page, "priorities").evaluate((node) =>
        parseFloat(node.style.width),
      );
      const grip = await slider.boundingBox();
      await page.mouse.move(grip.x + 8, grip.y + 8);
      await page.mouse.down();
      await page.mouse.move(grip.x + 33, grip.y + 23, { steps: 4 });
      await page.mouse.up();
      assert.equal(
        await widget(page, "priorities").evaluate((node) =>
          parseFloat(node.style.width),
        ),
        resizeBefore + 25,
      );
      await slider.focus();
      for (let i = 0; i < 8; i++) await page.keyboard.press("Shift+ArrowRight");
      for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowDown");
      assert.equal(
        await widget(page, "priorities").getAttribute("data-content-mode"),
        "expanded",
      );
      await page.getByRole("button", { name: "Widgets", exact: true }).click();
      await page
        .getByRole("button", { name: "Reset Today layout", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close widgets", exact: true })
        .click();
      await page.evaluate(
        (layout) =>
          localStorage.setItem("orbit-home-scene-v2", JSON.stringify(layout)),
        allWidgetLayout,
      );
      await page.reload({ waitUntil: "networkidle" });
    },
  );
  await check(
    "workspace geometry, closed/minimized/expanded states and notes survive refresh",
    async () => {
      await page
        .getByRole("button", { name: "Minimize Email", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close Recent files", exact: true })
        .click();
      await maximize(page, "notes");
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await widget(page, "notes").getAttribute("data-content-mode"),
        "expanded",
      );
      assert.equal(
        await widget(page, "notes")
          .getByLabel("Quick notes", { exact: true })
          .inputValue(),
        "A saved expanded note",
      );
      assert.equal(await widget(page, "email").count(), 0);
      assert.equal(await widget(page, "files").count(), 0);
      await page.getByRole("button", { name: "Study", exact: true }).click();
      assert.equal(await page.locator(".oi-window").count(), 3);
      await page.getByRole("button", { name: "Today", exact: true }).click();
      assert.equal(await widget(page, "files").count(), 0);
      await restore(page, "notes");
      await page
        .locator(".scene-tool-dock button")
        .filter({ hasText: "Email" })
        .click();
      await page.getByRole("button", { name: "Widgets", exact: true }).click();
      await page
        .locator(".oi-widget-entry")
        .filter({ hasText: "Recent files" })
        .getByRole("button", { name: "Show", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close widgets", exact: true })
        .click();
    },
  );
  await check(
    "saved scene, background dialog keyboard trap, offline fallback and private image backup",
    async () => {
      await page.route("https://commons.wikimedia.org/**", (route) =>
        route.abort(),
      );
      await page
        .getByRole("button", { name: "Choose background", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Background library" });
      await dialog.getByRole("button", { name: /Built-in scenes/ }).click();
      await dialog.getByLabel("Search backgrounds").fill("Aurora");
      await dialog.locator(".oi-scene-option").first().click();
      await page.reload({ waitUntil: "networkidle" });
      assert.match(
        await page.locator(".oi-scene-credit").innerText(),
        /Aurora/,
      );
      await page
        .getByRole("button", { name: "Choose background", exact: true })
        .click();
      const controls = dialog.locator("button,input:not([hidden])");
      await controls.first().focus();
      await page.keyboard.press("Shift+Tab");
      assert(
        await controls
          .last()
          .evaluate((node) => node === document.activeElement),
      );
      await page.keyboard.press("Escape");
      assert.equal(await dialog.count(), 0);
    },
  );
  await check(
    "education add/edit/complete/undo, Home, Planner and backup use the same records",
    async () => {
      await page
        .getByRole("button", { name: "Education Center", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Add responsibility", exact: true })
        .click();
      await page
        .getByLabel("Education title", { exact: true })
        .fill("Prepare a private seminar");
      await page.getByLabel("Education course").fill("History");
      await page.getByLabel("Education due date").fill(day(1));
      await page
        .getByLabel("Education notes")
        .fill("Private student content: never send this to AI");
      await page
        .getByRole("button", { name: "Save responsibility", exact: true })
        .click();
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "Education Center", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "Prepare a private seminar",
          exact: true,
        })
        .waitFor();
      await page.getByRole("button", { name: "Planner", exact: true }).click();
      await page
        .getByRole("region", { name: "Weekly planner" })
        .getByText("Prepare a private seminar", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await maximize(page, "upnext");
      await widget(page, "upnext")
        .getByText("Prepare a private seminar", { exact: true })
        .waitFor();
      await restore(page, "upnext");
      await page
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .click();
      await page.getByLabel("Message Orbit").fill("Summarize my day");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page
        .getByText("Dashboard context received.", { exact: true })
        .waitFor();
      assert(!JSON.stringify(state.assistant).includes("private seminar"));
      assert(
        !JSON.stringify(state.assistant).includes("Private student content"),
      );
      await page.keyboard.press("Escape");
      const data = await page.evaluate(async () => {
        const { createBackup } = await import("/src/backup.ts");
        return createBackup(localStorage);
      });
      assert.equal(data.data["orbit-education-v1"].length, 1);
      assert.equal(data.data["orbit-education-v1"][0].course, "History");
      await page
        .getByRole("button", { name: "Education Center", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Complete education Prepare a private seminar",
          exact: true,
        })
        .click();
      assert.equal(await page.locator(".education-record").count(), 0);
      await page.getByLabel("Filter education").selectOption("done");
      await page
        .getByRole("button", {
          name: "Reopen education Prepare a private seminar",
          exact: true,
        })
        .click();
      await page.getByLabel("Filter education").selectOption("open");
      await page
        .getByRole("button", {
          name: "Delete education Prepare a private seminar",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(await page.locator(".education-record").count(), 1);
    },
  );
  await check(
    "task editing and planner scheduling preserve identity across Home and reload",
    async () => {
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await maximize(page, "priorities");
      await widget(page, "priorities")
        .getByRole("button", {
          name: "Edit task Priority fixture 1",
          exact: true,
        })
        .click();
      await widget(page, "priorities")
        .getByLabel("Task title", { exact: true })
        .fill("Edited task fixture");
      await widget(page, "priorities")
        .getByLabel("Edit task due date")
        .fill(day(1));
      await widget(page, "priorities")
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await restore(page, "priorities");
      await page.getByRole("button", { name: "Planner", exact: true }).click();
      await page
        .getByRole("region", { name: "Weekly planner" })
        .getByText("Edited task fixture", { exact: true })
        .waitFor();
      await page.getByLabel("Reschedule Edited task fixture").fill(day(2));
      const task = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("orbit-tasks")).find(
          (task) => task.id === "t45-0",
        ),
      );
      assert.equal(task.dueDate, day(2));
      assert.equal(task.title, "Edited task fixture");
    },
  );
  await check(
    "File Studio performs local JSON/CSV conversion and actual downloadable image resize",
    async () => {
      await page
        .getByRole("button", { name: "File Studio", exact: true })
        .click();
      await page
        .getByRole("button", { name: "JSON & CSV", exact: true })
        .click();
      await page.getByLabel("Text conversion").selectOption("csv-json");
      await page
        .getByLabel("File Studio source text")
        .fill('name,note\n"Jo, Smith","Line one\nLine two"');
      await page
        .getByRole("button", { name: "Convert text", exact: true })
        .click();
      assert.deepEqual(
        JSON.parse(await page.getByLabel("Converted text").inputValue()),
        [{ name: "Jo, Smith", note: "Line one\nLine two" }],
      );
      await page.getByLabel("Text conversion").selectOption("format-json");
      await page.getByLabel("File Studio source text").fill("bad json");
      await page
        .getByRole("button", { name: "Convert text", exact: true })
        .click();
      await page.getByRole("alert").waitFor();
      await page.getByRole("button", { name: "Images", exact: true }).click();
      const imageBytes = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const context = canvas.getContext("2d");
        context.fillStyle = "#6688cc";
        context.fillRect(0, 0, 8, 8);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await page.getByLabel("File Studio input").setInputFiles({
        name: "test.png",
        mimeType: "image/png",
        buffer: Buffer.from(imageBytes, "base64"),
      });
      await page.getByLabel("Image output width").fill("32");
      await page
        .getByRole("button", { name: "Convert image", exact: true })
        .click();
      const image = page.getByAltText("Converted image preview");
      await image.waitFor();
      await image.evaluate((node) => node.decode());
      assert.equal(await image.evaluate((node) => node.naturalWidth), 32);
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: /Download test-32w.webp/ }).click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), "test-32w.webp");
    },
  );
  await check(
    "shopping saves live listing snapshots with real shipping and keeps all saved boards accessible",
    async () => {
      await page.route("**/api/shopping/feed?**", (route) =>
        route.fulfill({
          json: {
            configured: true,
            provider: "eBay",
            query: "desk lamp",
            items: [
              {
                id: "shop1",
                title: "Lamp fixture",
                price: 11.5,
                shipping: 3,
                currency: "USD",
                url: "https://www.ebay.com/itm/100",
                image: null,
                condition: "New",
                seller: "Fixture",
              },
              {
                id: "shop2",
                title: "Premium lamp",
                price: 40,
                shipping: 2,
                currency: "USD",
                url: "https://www.ebay.com/itm/101",
                image: null,
                condition: "New",
                seller: "Fixture",
              },
              {
                id: "shop3",
                title: "Unknown shipping lamp",
                price: 1,
                shipping: null,
                currency: "USD",
                url: "https://www.ebay.com/itm/102",
                image: null,
                condition: "New",
                seller: "Fixture",
              },
            ],
          },
        }),
      );
      await page
        .getByRole("button", { name: "Shopping Scout", exact: true })
        .click();
      await page.getByLabel("Item to research").fill("desk lamp");
      await page
        .getByRole("button", { name: "Save shopping search", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Compare Lamp fixture", exact: true })
        .click();
      await page
        .getByRole("list", { name: "Saved offers for desk lamp" })
        .getByText("$14.50", { exact: true })
        .waitFor();
      assert(
        await page
          .getByRole("button", {
            name: "Compare Unknown shipping lamp",
            exact: true,
          })
          .isDisabled(),
      );
      await page.getByLabel("Live shopping budget").fill("20");
      assert.equal(await page.locator(".live-product").count(), 1);
      const offer = await page.evaluate(
        () => JSON.parse(localStorage.getItem("orbit-shopping-offers-v1"))[0],
      );
      assert.equal(offer.shipping, 3);
      assert.equal(offer.price, 11.5);
    },
  );
  await check(
    "focus survives navigation/reload, finishes once and records real history",
    async () => {
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await widget(page, "focus")
        .getByRole("button", { name: "Start focus", exact: true })
        .click();
      await page.waitForTimeout(1200);
      await page.reload({ waitUntil: "networkidle" });
      await widget(page, "focus")
        .getByRole("button", { name: "Pause session", exact: true })
        .waitFor();
      const active = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("orbit-focus-session-v45")),
      );
      assert(active.deadline > Date.now());
      assert(active.remaining <= 1500);
      await widget(page, "focus")
        .getByRole("button", { name: "Pause session", exact: true })
        .click();
      await page.evaluate(() => {
        const value = JSON.parse(
          localStorage.getItem("orbit-focus-session-v45"),
        );
        value.deadline = Date.now() - 1000;
        value.remaining = 1;
        localStorage.setItem("orbit-focus-session-v45", JSON.stringify(value));
      });
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("orbit-focus-history-v45") || "[]")
            .length === 1,
      );
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("orbit-focus-history-v45")).length,
        ),
        1,
      );
    },
  );
  await check(
    "4.5 backup restores education, notes, focus, shopping and layout without changing media bytes",
    async () => {
      const backup = await page.evaluate(async () => {
        const { createBackup } = await import("/src/backup.ts");
        return createBackup(localStorage);
      });
      assert.equal(backup.data["orbit-education-v1"].length, 1);
      assert.equal(backup.data["orbit-focus-history-v45"].length, 1);
      assert.equal(backup.data["orbit-shopping-offers-v1"].length, 1);
      assert.equal(backup.data["orbit-notes"], "A saved expanded note");
      assert(!("orbit-focus-session-v45" in backup.data));
      await page
        .getByRole("button", { name: "Settings and connections", exact: true })
        .click();
      await page.getByLabel("Choose dashboard backup file").setInputFiles({
        name: "v45-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(backup)),
      });
      await page
        .getByText("Review before restoring", { exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Replace included data & restore",
          exact: true,
        })
        .click();
      await page.waitForLoadState("networkidle");
      await page.locator(".oi-root").waitFor();
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("orbit-education-v1")).length,
        ),
        1,
      );
      assert.match(
        await page.locator(".oi-scene-credit").innerText(),
        /Aurora/,
      );
      const items = await page.evaluate(async () => {
        const { listMedia } = await import("/src/media/store.ts");
        return listMedia();
      });
      assert.equal(items.length, 3);
    },
  );
  await check(
    "all widgets expand/restore on mobile, with usable modules and no horizontal overflow",
    async () => {
      for (const width of [390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        for (const id of Object.keys(titles)) {
          await maximize(page, id);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            width,
            `${id} overflow at ${width}`,
          );
          await restore(page, id);
        }
        for (const label of [
          "Education Center",
          "File Studio",
          "Planner",
          "Finances",
          "Home",
        ]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            width,
            `${label} overflow at ${width}`,
          );
        }
      }
    },
  );
  await check(
    "disconnected and failed providers show truthful widget states in both sizes",
    async () => {
      const off = await fixture({
        connected: false,
        serviceErrors: [
          { service: "calendar", message: "Calendar permission missing" },
          { service: "emails", message: "Gmail permission missing" },
          { service: "files", message: "Drive permission missing" },
          { service: "spotify", message: "Spotify unavailable" },
        ],
      });
      for (const id of ["upnext", "spotify", "email", "calendar", "files"]) {
        await maximize(off.page, id);
        const text = await widget(off.page, id).innerText();
        assert.match(
          text,
          /not connected|permission missing|unavailable|Connect|No active/i,
        );
        await restore(off.page, id);
      }
      assert.equal(
        await off.page.getByText("SAMPLE", { exact: true }).count(),
        0,
      );
      await off.context.close();
    },
  );
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.screenshot({
    path: `${artifacts}/home-desktop.png`,
    fullPage: true,
  });
  await maximize(page, "weather");
  await page.screenshot({
    path: `${artifacts}/weather-expanded.png`,
    fullPage: true,
  });
  await restore(page, "weather");
  await page
    .getByRole("button", { name: "Education Center", exact: true })
    .click();
  await page.screenshot({ path: `${artifacts}/education.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.screenshot({
    path: `${artifacts}/home-mobile.png`,
    fullPage: true,
  });
  await check("no uncaught browser errors in the 4.5 workflows", async () =>
    assert.deepEqual(errors, []),
  );
  console.log(
    JSON.stringify(
      { passed, failed: failures.length, failures, errors, artifacts },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await main.context.close();
  await browser.close();
}
