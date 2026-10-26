/** Orbit V3 functional browser checks. Start npm run dev first. Uses generated test media only. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const base = process.env.ORBIT_URL || "http://127.0.0.1:5173";
const folder = await mkdtemp(join(tmpdir(), "orbit-v3-browser-"));
const movie = join(folder, "Orbit Test Movie.webm"),
  episode = join(folder, "Orbit Test Episode.webm"),
  photo = join(folder, "Orbit Test Photo.png");
for (const [path, duration, color] of [
  [movie, 8, "0x263455"],
  [episode, 5, "0x58644a"],
])
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=320x180:r=15`,
    "-t",
    String(duration),
    "-c:v",
    "libvpx",
    "-deadline",
    "realtime",
    "-b:v",
    "120k",
    "-pix_fmt",
    "yuv420p",
    path,
  ]);
await writeFile(
  photo,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhHgAAAAASUVORK5CYII=",
    "base64",
  ),
);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const failures = [],
  runtimeErrors = [],
  consoleErrors = [];
let passed = 0;
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  timezoneId: "America/New_York",
  reducedMotion: "reduce",
  acceptDownloads: true,
});
await context.addInitScript(() => {
  window.SpeechRecognition = class {
    start() {
      window.testRecognition = this;
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.onend?.();
    }
  };
  const originalCreate = URL.createObjectURL,
    originalRevoke = URL.revokeObjectURL;
  window.testBlobUrls = new Set();
  URL.createObjectURL = function (...args) {
    const url = originalCreate.apply(URL, args);
    window.testBlobUrls.add(url);
    return url;
  };
  URL.revokeObjectURL = function (url) {
    window.testBlobUrls.delete(url);
    return originalRevoke.call(URL, url);
  };
});
let assistantConfigured = false;
await context.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  let body = {};
  if (url.pathname === "/api/connections")
    body = {
      google: {
        configured: false,
        connected: false,
        authUrl: "/api/auth/google",
      },
      spotify: {
        configured: false,
        connected: false,
        authUrl: "/api/auth/spotify",
      },
      calendar: { connected: false, source: null },
      assistant: {
        configured: assistantConfigured,
        transcription: assistantConfigured,
      },
    };
  else if (url.pathname === "/api/dashboard")
    body = {
      calendar: [],
      emails: [],
      files: [],
      spotify: null,
      errors: [],
      updatedAt: new Date().toISOString(),
    };
  else if (url.pathname === "/api/weather")
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
        humidity: 60,
        windSpeed: 8,
        weatherCode: 2,
        isDay: true,
        time: new Date().toISOString(),
      },
      daily: Array.from({ length: 5 }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
        high: 65,
        low: 49,
        weatherCode: 2,
        precipitationChance: 10,
      })),
      updatedAt: new Date().toISOString(),
      attribution: "Open-Meteo",
    };
  else if (url.pathname === "/api/assistant")
    body = {
      message: "I propose one concrete next step for your review.",
      suggestedTasks: ["Review V3 proposal fixture"],
    };
  else if (url.pathname === "/api/weather/locations") body = { locations: [] };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});
const page = await context.newPage();
page.on("pageerror", (e) => runtimeErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
const visible = (locator) =>
  locator.waitFor({ state: "visible", timeout: 8000 });
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (e) {
    failures.push({ name, error: String(e) });
    console.error(`FAIL ${name}: ${e}`);
    if (await page.getByRole("button", { name: "Close media player" }).count())
      await page
        .getByRole("button", { name: "Close media player" })
        .click()
        .catch(() => {});
  }
}
async function nav(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function metadata() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("orbit-media", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("items", "readonly");
          const get = tx.objectStore("items").getAll();
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
          tx.oncomplete = () => db.close();
        };
        request.onerror = () => reject(request.error);
      }),
  );
}
async function capture(type, title, extra) {
  await page
    .getByRole("button", { name: "Quick capture", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Capture title" }).fill(title);
  await page.getByRole("combobox", { name: "Capture type" }).selectOption(type);
  await extra?.();
  await page.getByRole("button", { name: "Capture it", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Quick capture", exact: true })
    .waitFor({ state: "hidden" });
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await check(
    "media center is a genuine side tab with empty movies, TV and photo slots",
    async () => {
      await nav("Media Center");
      await visible(page.getByRole("heading", { name: "Library" }));
      for (const name of ["Movies", "TV shows", "Photos"]) {
        await page
          .getByRole("button", { name: new RegExp(`^${name}`) })
          .click();
        assert.equal(await page.locator(".media-item").count(), 0);
      }
      await page.getByRole("button", { name: /^Movies/ }).click();
    },
  );
  await check(
    "local video import persists metadata and original bytes without a server upload",
    async () => {
      let requests = 0;
      const watcher = (req) => {
        if (req.method() === "POST" && req.url().startsWith(base)) requests++;
      };
      page.on("request", watcher);
      await page.getByLabel("Import media files").setInputFiles(movie);
      await visible(
        page.getByRole("heading", { name: "Orbit Test Movie", exact: true }),
      );
      const rows = await metadata();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].size, (await readFile(movie)).length);
      assert.equal(rows[0].kind, "movies");
      await page.reload({ waitUntil: "networkidle" });
      await nav("Media Center");
      await visible(
        page.getByRole("heading", { name: "Orbit Test Movie", exact: true }),
      );
      page.off("request", watcher);
      assert.equal(requests, 0);
    },
  );
  await check(
    "built-in player decodes and plays actual generated WebM",
    async () => {
      await page
        .getByRole("button", { name: "Play Orbit Test Movie", exact: true })
        .click();
      await visible(
        page.getByRole("dialog", { name: "Playing Orbit Test Movie" }),
      );
      const video = page.locator("video");
      await page.waitForFunction(() => {
        const v = document.querySelector("video");
        return v && Number.isFinite(v.duration) && v.duration > 7;
      });
      assert.notEqual(
        await video.evaluate((v) => v.canPlayType("video/webm")),
        "",
      );
      await video.evaluate((v) =>
        Promise.race([
          v.play(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "play() did not settle within 5 seconds; readyState=" +
                      v.readyState,
                  ),
                ),
              5000,
            ),
          ),
        ]),
      );
      await page.waitForFunction(
        () => document.querySelector("video")?.currentTime > 0.3,
        {},
        { timeout: 6000 },
      );
      await video.evaluate((v) => {
        v.currentTime = 3.4;
        v.pause();
      });
      await page.getByRole("button", { name: "Close media player" }).click();
      await page.waitForFunction(
        () => window.testBlobUrls.size === 0,
        {},
        { timeout: 6500 },
      );
      const rows = await metadata();
      assert(rows[0].duration > 7);
      assert(rows[0].progress >= 3.3);
    },
  );
  await check(
    "resume point survives closing and reopening the player",
    async () => {
      await page
        .getByRole("button", { name: "Play Orbit Test Movie", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("video")?.currentTime >= 3.3,
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await visible(page.getByText("Resume 0:03", { exact: true }));
    },
  );
  await check("favorites and media search are functional", async () => {
    await page
      .getByRole("button", { name: "Favorite Orbit Test Movie", exact: true })
      .click();
    await visible(
      page.getByRole("button", {
        name: "Unfavorite Orbit Test Movie",
        exact: true,
      }),
    );
    await page
      .getByRole("combobox", { name: "Filter media" })
      .selectOption("favorites");
    assert.equal(await page.locator(".media-item").count(), 1);
    await page
      .getByRole("searchbox", { name: "Search your media" })
      .fill("no-matching-title");
    await visible(
      page.getByRole("heading", { name: "No matches in this corner." }),
    );
    await page.getByRole("button", { name: "Clear filters" }).click();
    await visible(
      page.getByRole("heading", { name: "Orbit Test Movie", exact: true }),
    );
    assert.equal(await page.locator(".media-item").count(), 1);
  });
  await check(
    "TV episodes support metadata editing and a reorderable tonight queue",
    async () => {
      await page
        .getByRole("button", {
          name: "Queue for tonight Orbit Test Movie",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: /^TV shows/ }).click();
      await page.getByLabel("Import media files").setInputFiles(episode);
      await visible(
        page.getByRole("heading", { name: "Orbit Test Episode", exact: true }),
      );
      await page
        .getByRole("button", { name: "Edit Orbit Test Episode", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Show or series" })
        .fill("Orbit Test Series");
      await page.getByRole("spinbutton", { name: "Season number" }).fill("1");
      await page
        .getByRole("textbox", { name: "Episode or season" })
        .fill("Season 1 · Episode 1");
      await page.getByRole("button", { name: "Save details" }).click();
      await visible(
        page.getByText("Season 1 · Episode 1", { exact: false }).first(),
      );
      await page
        .getByRole("button", {
          name: "Queue for tonight Orbit Test Episode",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: /Tonight’s queue/ }).click();
      assert.equal(await page.locator(".media-queue-list>li").count(), 2);
      await page
        .getByRole("button", { name: "Move Orbit Test Episode up" })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector(".queue-title strong")?.textContent ===
          "Orbit Test Episode",
      );
      const rows = await metadata();
      assert(
        rows.find((x) => x.title === "Orbit Test Episode").queueOrder <
          rows.find((x) => x.title === "Orbit Test Movie").queueOrder,
      );
    },
  );
  await check(
    "explicit Player section opens a queued local file without a streaming account",
    async () => {
      await page
        .getByRole("button", { name: "Your library", exact: true })
        .click();
      await page.getByRole("button", { name: "Player", exact: true }).click();
      await visible(
        page.getByRole("button", {
          name: "Open player for Orbit Test Movie",
          exact: true,
        }),
      );
      await page
        .getByRole("button", {
          name: "Open player for Orbit Test Movie",
          exact: true,
        })
        .click();
      await visible(
        page.getByRole("dialog", { name: "Playing Orbit Test Movie" }),
      );
      await page.keyboard.press("Escape");
    },
  );
  await check("photos import and display in the built-in viewer", async () => {
    await page
      .getByRole("button", { name: "Your library", exact: true })
      .click();
    await page.getByRole("button", { name: /^Photos/ }).click();
    await page.getByLabel("Import media files").setInputFiles(photo);
    await visible(
      page.getByRole("heading", { name: "Orbit Test Photo", exact: true }),
    );
    await page
      .getByRole("button", { name: "View Orbit Test Photo", exact: true })
      .click();
    await visible(
      page.getByRole("dialog", { name: "Playing Orbit Test Photo" }),
    );
    await page.waitForFunction(() => {
      const i = document.querySelector(".photo-screen img");
      return i?.complete && i.naturalWidth === 1;
    });
    await page.keyboard.press("Escape");
  });
  await check(
    "duplicate imports do not silently create duplicate files",
    async () => {
      await page.getByLabel("Import media files").setInputFiles(photo);
      await visible(
        page.getByRole("alert").filter({ hasText: /already in your library/ }),
      );
      assert.equal(
        (await metadata()).filter((x) => x.kind === "photos").length,
        1,
      );
      await page.getByRole("button", { name: "Dismiss media error" }).click();
    },
  );
  await check(
    "removing library files requires confirmation and preserves other categories",
    async () => {
      await page
        .getByRole("button", { name: "Remove Orbit Test Photo", exact: true })
        .click();
      await visible(page.getByRole("dialog", { name: "Remove this file?" }));
      await page.getByRole("button", { name: "Keep it", exact: true }).click();
      assert.equal((await metadata()).length, 3);
      await page
        .getByRole("button", { name: "Remove Orbit Test Photo", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Remove from library", exact: true })
        .click();
      await page.waitForFunction(() => !document.querySelector(".media-item"));
      assert.equal((await metadata()).length, 2);
    },
  );
  await check(
    "dashboard continue-watching summary opens the correct saved movie",
    async () => {
      await nav("Overview");
      await visible(
        page.getByText("PICK UP WHERE YOU LEFT OFF", { exact: true }),
      );
      await page.locator(".media-summary-play").click();
      await visible(
        page.getByRole("dialog", { name: "Playing Orbit Test Movie" }),
      );
      await page.getByRole("button", { name: "Close media player" }).click();
      await nav("Overview");
    },
  );
  await check(
    "DoorDash handoff rejects unsafe URLs and labels status as manual",
    async () => {
      await page
        .getByRole("button", { name: "Add DoorDash tracking", exact: false })
        .click();
      await page
        .getByRole("textbox", { name: "Restaurant or order label" })
        .fill("Test dinner");
      await page
        .getByLabel("DoorDash tracking link")
        .fill("javascript:alert(1)");
      await page
        .getByRole("button", { name: "Save delivery", exact: false })
        .click();
      await visible(page.getByRole("alert"));
      assert.equal(await page.locator(".delivery-order").count(), 0);
      await page
        .getByLabel("DoorDash tracking link")
        .fill("https://www.doordash.com/orders/test-private-order");
      const local = await page.evaluate(() => {
        const eta = new Date(Date.now() + 30 * 60 * 1000);
        return `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, "0")}-${String(eta.getDate()).padStart(2, "0")}T${String(eta.getHours()).padStart(2, "0")}:${String(eta.getMinutes()).padStart(2, "0")}`;
      });
      await page.getByLabel("Estimated arrival").fill(local);
      await page
        .getByRole("button", { name: "Save delivery", exact: false })
        .click();
      await visible(page.getByRole("heading", { name: "Test dinner" }));
      await visible(page.getByText("Manual status", { exact: true }));
      assert.equal(
        await page
          .getByRole("link", { name: "Open live tracking in DoorDash" })
          .getAttribute("rel"),
        "noopener noreferrer",
      );
      assert(
        !(await page
          .locator(".delivery-card")
          .textContent()
          .then((x) => x.includes("test-private-order"))),
      );
      await page
        .getByRole("button", { name: "Set status On the way", exact: true })
        .click();
      await visible(page.getByText("On the way", { exact: false }).first());
      await page.reload({ waitUntil: "networkidle" });
      await visible(page.getByRole("heading", { name: "Test dinner" }));
    },
  );
  await check(
    "delivery removal is explicit and does not claim cancellation",
    async () => {
      await page
        .getByRole("button", { name: "Clear order", exact: false })
        .click();
      await visible(page.getByRole("dialog", { name: "Clear saved delivery" }));
      await visible(
        page.getByText(/won’t cancel or change your DoorDash order/),
      );
      await page
        .getByRole("button", { name: "Keep order", exact: true })
        .click();
      await visible(page.getByRole("heading", { name: "Test dinner" }));
    },
  );
  await check(
    "quick capture adds real school, finance, habit and task data locally",
    async () => {
      await capture("school", "Browser test assignment");
      await visible(
        page.getByRole("button", {
          name: "Complete responsibility Browser test assignment",
        }),
      );
      await capture("finance", "Browser test savings", () =>
        page
          .getByRole("spinbutton", { name: "Goal target amount" })
          .fill("500"),
      );
      await page
        .getByRole("spinbutton", {
          name: "Current amount for Browser test savings",
        })
        .fill("125");
      await capture("habit", "Browser test stretch");
      const habit = page.getByRole("button", { name: /Browser test stretch/ });
      await habit.click();
      assert.equal(await habit.getAttribute("aria-pressed"), "true");
      await capture("task", "Browser test captured task");
      await visible(
        page.getByRole("button", {
          name: "Complete Browser test captured task",
        }),
      );
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page
          .getByRole("spinbutton", {
            name: "Current amount for Browser test savings",
          })
          .inputValue(),
        "125",
      );
      assert.equal(
        await page
          .getByRole("button", { name: /Browser test stretch/ })
          .getAttribute("aria-pressed"),
        "true",
      );
    },
  );
  await check(
    "AI task proposals require explicit approval and create an activity record",
    async () => {
      assistantConfigured = true;
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "Orbit assistant", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Message Orbit" })
        .fill("Suggest a next step");
      await page.getByRole("button", { name: "Send message" }).click();
      await visible(
        page.getByText("I propose one concrete next step for your review."),
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("button", { name: "Complete Review V3 proposal fixture" })
          .count(),
        0,
      );
      await visible(
        page
          .locator(".approval-row")
          .filter({ hasText: "Review V3 proposal fixture" }),
      );
      await page
        .locator(".approval-row")
        .filter({ hasText: "Review V3 proposal fixture" })
        .getByRole("button", { name: "Approve", exact: true })
        .click();
      await visible(
        page.getByRole("button", {
          name: "Complete Review V3 proposal fixture",
        }),
      );
      assert.equal(await page.locator(".approval-row").count(), 0);
      assert.match(
        await page.locator(".approval-card").textContent(),
        /Approved and added/,
      );
    },
  );
  await check(
    "backup export excludes credentials, delivery links and media while retaining dashboard data",
    async () => {
      await page.evaluate(() =>
        localStorage.setItem("GOOGLE_CLIENT_SECRET", "fake-export-canary"),
      );
      await page
        .getByRole("button", { name: "Settings and connections" })
        .click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page
          .getByRole("button", { name: "Export dashboard", exact: true })
          .click(),
      ]);
      const backup = JSON.parse(await readFile(await download.path(), "utf8"));
      assert.equal(backup.format, "orbit-dashboard-backup");
      assert(
        backup.data["orbit-tasks"].some(
          (x) => x.title === "Browser test captured task",
        ),
      );
      const serialized = JSON.stringify(backup);
      assert(!serialized.includes("test-private-order"));
      assert(!serialized.includes("fake-export-canary"));
      assert(!serialized.includes("Orbit Test Movie"));
      await page.getByLabel("Choose dashboard backup file").setInputFiles({
        name: "bad-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          '{"format":"wrong","data":{"GOOGLE_CLIENT_SECRET":"oops"}}',
        ),
      });
      await visible(page.locator(".backup-panel [role=alert]"));
      assert.equal(
        await page
          .getByRole("button", {
            name: "Replace included data & restore",
            exact: true,
          })
          .count(),
        0,
      );
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "backup restore previews included sections and leaves delivery, media and unknown private data untouched",
    async () => {
      await page
        .getByRole("button", { name: "Settings and connections" })
        .click();
      const backup = {
        format: "orbit-dashboard-backup",
        version: "1",
        createdAt: new Date().toISOString(),
        data: { "orbit-notes": "V3 restored note fixture" },
      };
      await page.getByLabel("Choose dashboard backup file").setInputFiles({
        name: "valid-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(backup)),
      });
      await visible(page.getByText("Review before restoring", { exact: true }));
      assert.notEqual(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("orbit-notes") || '""'),
        ),
        "V3 restored note fixture",
      );
      await page
        .getByRole("button", {
          name: "Replace included data & restore",
          exact: true,
        })
        .click();
      await page.waitForLoadState("networkidle");
      assert.equal(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("orbit-notes")),
        ),
        "V3 restored note fixture",
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem("GOOGLE_CLIENT_SECRET")),
        "fake-export-canary",
      );
      assert(
        (
          await page.evaluate(() => localStorage.getItem("orbit-delivery-v3"))
        ).includes("test-private-order"),
      );
      assert.equal((await metadata()).length, 2);
    },
  );
  await check(
    "responsive dashboard, media library and player stay within four viewport widths",
    async () => {
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1100 });
        for (const view of ["Overview", "Media Center"]) {
          await nav(view);
          const size = await page.evaluate(() => ({
            viewport: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert.equal(
            size.scroll,
            size.viewport,
            `${view} overflow at${width}: ${JSON.stringify(size)}`,
          );
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: /^Movies/ }).click();
      await page
        .getByRole("button", { name: "Play Orbit Test Movie", exact: true })
        .click();
      const bounds = await page
        .getByRole("dialog", { name: "Playing Orbit Test Movie" })
        .boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
      await page.keyboard.press("Escape");
    },
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await nav("Overview");
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1430, 5);
  await page.screenshot({ path: "/tmp/orbit-v3-overview.png", fullPage: true });
  await nav("Media Center");
  await page.getByRole("button", { name: /^Movies/ }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1430, 5);
  await page.screenshot({ path: "/tmp/orbit-v3-media.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(389, 5);
  await page.screenshot({ path: "/tmp/orbit-v3-mobile.png", fullPage: true });
  await check("V3 produced no uncaught browser runtime errors", async () =>
    assert.deepEqual(runtimeErrors, []),
  );
  console.log(
    JSON.stringify(
      {
        passed,
        failed: failures.length,
        failures,
        runtimeErrors,
        consoleErrors,
        screenshots: [
          "/tmp/orbit-v3-overview.png",
          "/tmp/orbit-v3-media.png",
          "/tmp/orbit-v3-mobile.png",
        ],
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await rm(folder, { recursive: true, force: true });
}
