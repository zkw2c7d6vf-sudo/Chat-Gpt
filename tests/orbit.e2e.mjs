/**
 * Browser smoke suite. Start npm run dev before running.
 * Uses system Chromium when available, otherwise Playwright's bundled browser.
 * CHROMIUM_PATH overrides the executable. No account credentials required.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
const executablePath =
  process.env.CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const failures = [],
  errors = [],
  consoleErrors = [];
let passed = 0;
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
async function check(name, run) {
  try {
    await run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
  }
}
async function visible(locator) {
  await locator.waitFor({ state: "visible", timeout: 6000 });
}
const base = process.env.ORBIT_URL || "http://127.0.0.1:5173";
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await check("dashboard renders labeled sample data", async () => {
    await visible(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
    );
    await visible(page.getByText("Demo space", { exact: true }));
    assert.equal(await page.getByText("SAMPLE", { exact: true }).count(), 3);
    await visible(page.getByText("A good day starts", { exact: false }));
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1430, 20);
  await page.screenshot({ path: "/tmp/orbit-desktop.png", fullPage: true });
  await check("calendar navigation and week change", async () => {
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await visible(
      page.getByRole("heading", { name: "Make space for your day." }),
    );
    assert.equal(await page.locator(".agenda-event").count(), 4);
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await visible(page.getByText("No events on this day."));
    await page
      .getByRole("button", { name: "Back to today", exact: true })
      .click();
    assert.equal(await page.locator(".agenda-event").count(), 4);
    await page.locator(".agenda-event").first().click();
    await visible(page.getByRole("dialog"));
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
  });
  await check("inbox filters and detail read state", async () => {
    await page.getByRole("button", { name: "Inbox", exact: true }).click();
    assert.equal(await page.locator(".mail-item").count(), 3);
    await page.getByRole("button", { name: /All mail/ }).click();
    assert.equal(await page.locator(".mail-item").count(), 4);
    await page.locator(".mail-item").first().click();
    await visible(page.getByRole("dialog"));
    await visible(
      page.getByText(
        "This is sample content. Your emails will appear after connecting Google.",
      ),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".mail-item.unread").count(), 1);
  });
  await check("files view and file detail", async () => {
    await page.getByRole("button", { name: "Files", exact: true }).click();
    assert.equal(await page.locator(".file-tile").count(), 4);
    await page.locator(".file-tile").first().click();
    await visible(page.getByRole("dialog"));
    await visible(page.getByRole("button", { name: "Connect Google Drive" }));
    await page.keyboard.press("Escape");
  });
  await check("global keyboard search returns matching items", async () => {
    await page.keyboard.press("Control+k");
    await page
      .getByRole("textbox", { name: "Search everything" })
      .fill("adventure");
    assert.equal(await page.locator(".search-result").count(), 2);
    await page
      .getByRole("textbox", { name: "Search everything" })
      .fill("qzxnone");
    await visible(page.getByText("No matches, just yet."));
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
  });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await check("tasks persist, complete, and delete", async () => {
    const input = page.getByRole("textbox", { name: "Add a little to-do" });
    await input.fill("Browser smoke task");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    assert.equal(
      await page.getByText("Browser smoke task", { exact: true }).count(),
      1,
    );
    await visible(page.getByText("Browser smoke task", { exact: true }));
    await page.reload({ waitUntil: "networkidle" });
    await visible(page.getByText("Browser smoke task", { exact: true }));
    await page
      .getByRole("button", { name: "Complete Browser smoke task", exact: true })
      .click();
    await visible(
      page.getByRole("button", {
        name: "Uncomplete Browser smoke task",
        exact: true,
      }),
    );
    await page
      .getByRole("button", { name: "Delete Browser smoke task", exact: true })
      .click();
    assert.equal(
      await page.getByText("Browser smoke task", { exact: true }).count(),
      0,
    );
  });
  await check("private notes persist on reload", async () => {
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Private notes" })
      .fill("Browser smoke note");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "Private notes" }).inputValue(),
      "Browser smoke note",
    );
    await page.getByRole("textbox", { name: "Private notes" }).fill("");
  });
  await check("focus timer ticks, pauses, resets", async () => {
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await visible(page.getByRole("button", { name: "Pause session" }));
    await page.waitForTimeout(1200);
    assert.match(
      await page.locator(".timer-ring>span").textContent(),
      /24:5[89]/,
    );
    await page.getByRole("button", { name: "Pause session" }).click();
    const paused = await page.locator(".timer-ring>span").textContent();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator(".timer-ring>span").textContent(), paused);
    await page.getByRole("button", { name: "Reset focus timer" }).click();
    assert.equal(await page.locator(".timer-ring>span").textContent(), "25:00");
  });
  await check(
    "assistant local commands add tasks and summarize day",
    async () => {
      await page
        .getByRole("button", { name: "Talk to Orbit", exact: true })
        .click();
      await visible(page.getByRole("dialog", { name: "Orbit assistant" }));
      await page
        .getByRole("textbox", { name: "Message Orbit" })
        .fill("Add task: Assistant smoke task");
      await page.getByRole("button", { name: "Send message" }).click();
      await visible(
        page.getByText("Added “Assistant smoke task” to your little to-dos."),
      );
      await page
        .getByRole("textbox", { name: "Message Orbit" })
        .fill("What is my day like?");
      await page.getByRole("button", { name: "Send message" }).click();
      await visible(page.getByText(/You’re viewing a sample day/));
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page
        .getByRole("button", { name: "Little to-dos", exact: false })
        .click();
      await visible(page.getByText("Assistant smoke task", { exact: true }));
      await page
        .getByRole("button", { name: "Delete Assistant smoke task" })
        .click();
    },
  );
  await check("microphone keeps an unsent draft intact", async () => {
    await page
      .getByRole("button", { name: "Talk to Orbit", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Message Orbit" })
      .fill("A draft to keep");
    await page.evaluate(() => {
      window.SpeechRecognition = class {
        start() {}
        stop() {
          this.onend?.();
        }
      };
    });
    const before = await page.locator(".chat-message.user").count();
    await page.getByRole("button", { name: "Use microphone" }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "Message Orbit" }).inputValue(),
      "A draft to keep",
    );
    assert.equal(await page.locator(".chat-message.user").count(), before);
    await page.getByRole("button", { name: "Stop microphone" }).click();
    await page.getByRole("textbox", { name: "Message Orbit" }).fill("");
    await page.keyboard.press("Escape");
  });
  await check(
    "connections honestly report missing account configuration",
    async () => {
      await page
        .getByRole("button", { name: "Settings and connections" })
        .click();
      await visible(
        page.getByRole("dialog", { name: "Bring your world into orbit." }),
      );
      await visible(page.getByText("Google · Setup needed"));
      await visible(page.getByText("Spotify · Setup needed"));
      await page
        .getByRole("button", { name: "Connect", exact: true })
        .first()
        .click();
      await visible(page.getByRole("status"));
      assert.match(
        await page.getByRole("status").textContent(),
        /Set up Google OAuth/,
      );
      await page.keyboard.press("Escape");
    },
  );
  await check("desktop has no horizontal overflow", async () => {
    const size = await page.evaluate(() => ({
      viewport: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.equal(size.scroll, size.viewport);
  });
  await page.evaluate(() => {
    localStorage.removeItem("orbit-read");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1430, 20);
  await page.screenshot({ path: "/tmp/orbit-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await check("mobile overview and views stay within viewport", async () => {
    for (const v of ["Overview", "Calendar", "Inbox", "Files"]) {
      await page.getByRole("button", { name: v, exact: true }).click();
      const size = await page.evaluate(() => ({
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.equal(
        size.scroll,
        size.viewport,
        `${v} overflow: ${JSON.stringify(size)}`,
      );
    }
    await page.getByRole("button", { name: "Overview", exact: true }).click();
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(389, 10);
  await page.screenshot({ path: "/tmp/orbit-mobile.png", fullPage: true });
  await check("mobile chat and settings fit in viewport", async () => {
    await page
      .getByRole("button", { name: "Talk to Orbit", exact: true })
      .click();
    const rect = await page
      .getByRole("dialog", { name: "Orbit assistant" })
      .boundingBox();
    assert(rect.x >= 0 && rect.x + rect.width <= 390);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Settings and connections" })
      .click();
    const modal = await page.getByRole("dialog").boundingBox();
    assert(modal.x >= 0 && modal.x + modal.width <= 390);
    await page.keyboard.press("Escape");
  });
  await check(
    "connected service data, playback, and configured AI flow",
    async () => {
      const liveContext = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        reducedMotion: "reduce",
        timezoneId: "America/Los_Angeles",
      });
      const lp = await liveContext.newPage();
      lp.on("pageerror", (error) => errors.push(error.message));
      let playing = true;
      let assistantBody = null;
      let playbackBody = null;
      const dateOnly = await lp.evaluate(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      });
      const time = (hours) => {
        const d = new Date();
        d.setHours(hours, 0, 0, 0);
        return d.toISOString();
      };
      await lp.route("**/api/**", async (route) => {
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
            assistant: { configured: true },
          };
        else if (url.pathname === "/api/dashboard")
          body = {
            calendar: [
              {
                id: "live-event",
                title: "Live calendar check",
                start: time(12),
                end: time(13),
                location: "Studio",
                url: "https://calendar.google.com/",
              },
              {
                id: "all-day",
                title: "All-day local-date check",
                start: dateOnly,
                end: dateOnly,
                location: "Local calendar",
                allDay: true,
              },
            ],
            emails: [
              {
                id: "live-mail",
                from: "Real Sender",
                subject: "Live mail check",
                snippet: "A live-account summary.",
                time: time(10),
                unread: true,
                important: true,
                url: "https://mail.google.com/",
              },
            ],
            files: [
              {
                id: "live-file",
                name: "Live document check",
                type: "document",
                modifiedAt: time(9),
                owner: "You",
                url: "https://drive.google.com/",
              },
            ],
            spotify: {
              id: "track",
              title: "Live track check",
              artist: "Test Artist",
              album: "Test Album",
              coverUrl: "",
              isPlaying: playing,
              progressMs: 30000,
              durationMs: 120000,
              url: "https://open.spotify.com/",
              device: "Test device",
            },
            errors: [],
            updatedAt: new Date().toISOString(),
          };
        else if (url.pathname === "/api/spotify/playback") {
          playbackBody = route.request().postDataJSON();
          playing = playbackBody.playing;
          body = { ok: true };
        } else if (url.pathname === "/api/assistant") {
          assistantBody = route.request().postDataJSON();
          body = {
            message:
              "A verified assistant response from your connected dashboard.",
          };
        } else body = { ok: true };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      await lp.goto(base, { waitUntil: "networkidle" });
      await visible(lp.getByText("Live calendar check", { exact: true }));
      await visible(lp.getByText("All-day local-date check", { exact: true }));
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
      assert.deepEqual(playbackBody, { playing: false });
      await lp
        .getByRole("button", { name: "Talk to Orbit", exact: true })
        .click();
      await lp
        .getByRole("textbox", { name: "Message Orbit" })
        .fill("How is my day looking?");
      await lp.getByRole("button", { name: "Send message" }).click();
      await visible(
        lp.getByText(
          "A verified assistant response from your connected dashboard.",
        ),
      );
      assert.equal(assistantBody.message, "How is my day looking?");
      assert.equal(
        assistantBody.context.events[0].title,
        "Live calendar check",
      );
      await liveContext.close();
    },
  );
  await check("no uncaught browser runtime errors", async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
  });
  console.log(
    JSON.stringify(
      {
        passed,
        failed: failures.length,
        failures,
        runtimeErrors: errors,
        consoleErrors,
        screenshots: ["/tmp/orbit-desktop.png", "/tmp/orbit-mobile.png"],
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
