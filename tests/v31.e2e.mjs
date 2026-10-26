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
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/weather**", (route) => {
  const date = new Date().toISOString().slice(0, 10);
  return route.fulfill({
    json: {
      location: {
        name: "Buffalo",
        latitude: 42.8864,
        longitude: -78.8784,
        timezone: "America/New_York",
      },
      unit: "fahrenheit",
      current: {
        temperature: 58,
        feelsLike: 55,
        humidity: 62,
        windSpeed: 7,
        weatherCode: 3,
        isDay: true,
        time: date + "T12:00",
      },
      daily: Array.from({ length: 5 }, (_, i) => ({
        date: new Date(Date.now() + i * 864e5).toISOString().slice(0, 10),
        high: 61,
        low: 44,
        weatherCode: 3,
        precipitationChance: 20,
      })),
      updatedAt: new Date().toISOString(),
      attribution: "Open-Meteo",
    },
  });
});
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
try {
  await page.clock.install({ time: new Date("2026-10-25T11:59:50-04:00") });
  await page.goto(process.env.ORBIT_URL || "http://127.0.0.1:5173", {
    waitUntil: "networkidle",
  });
  await check(
    "personal greeting, no copilot or cartoon graphics, no filler subtitle",
    async () => {
      await page.getByRole("heading", { name: "Good morning, Joe." }).waitFor();
      assert.equal(
        await page.locator(".copilot-card,.orbit-character,.hero").count(),
        0,
      );
      assert.equal(await page.locator(".page-heading p").count(), 0);
      assert.equal(await page.locator(".local-clock svg").count(), 1);
      assert.equal(
        await page
          .getByText(
            "Your essentials. Your next steps. A copilot by your side.",
          )
          .count(),
        0,
      );
    },
  );
  await check(
    "active desktop navigation label stays inside its button",
    async () => {
      const button = await page
        .getByRole("button", { name: "Overview", exact: true })
        .boundingBox();
      const label = await page
        .locator(".nav-item.active .nav-text")
        .boundingBox();
      assert(
        label.x >= button.x && label.x + label.width <= button.x + button.width,
      );
    },
  );
  await check(
    "greeting changes across noon while the page stays open",
    async () => {
      await page.clock.fastForward(40000);
      await page
        .getByRole("heading", { name: "Good afternoon, Joe." })
        .waitFor();
      assert.match(
        await page.locator(".local-clock").textContent(),
        /12:00 PM/,
      );
    },
  );
  await check("greeting changes into evening without reloading", async () => {
    await page.clock.fastForward(5 * 3600 * 1000);
    await page.getByRole("heading", { name: "Good evening, Joe." }).waitFor();
  });
  await check("all views fit desktop, tablet and mobile", async () => {
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const name of [
        "Overview",
        "Calendar",
        "Inbox",
        "Files",
        "Media Center",
        "Shopping Scout",
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${name} overflows at ${width}`,
        );
      }
    }
  });
  await check(
    "navigation, private notes and capture remain accessible",
    async () => {
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await page.getByRole("button", { name: "Notes", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Private notes" })
        .fill("3.1 test note");
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Notes", exact: true }).click();
      assert.equal(
        await page.getByRole("textbox", { name: "Private notes" }).inputValue(),
        "3.1 test note",
      );
      await page.getByRole("textbox", { name: "Private notes" }).fill("");
      await page
        .getByRole("button", { name: "Quick capture", exact: true })
        .first()
        .click();
      await page
        .getByRole("dialog", { name: "Quick capture", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Tasks", exact: false })
        .first()
        .click();
    },
  );
  await check(
    "shopping research saves local searches and compares saved prices",
    async () => {
      await page
        .getByRole("button", { name: "Shopping Scout", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Item to research" })
        .fill("navy jacket");
      await page.getByRole("button", { name: "Save shopping search" }).click();
      await page.getByText("navy jacket", { exact: true }).waitFor();
      assert.equal(
        await page.getByText(/does not scrape retailers/i).count(),
        1,
      );
      assert.equal(await page.getByRole("link", { name: /Amazon/ }).count(), 1);
      await page.getByRole("button", { name: /Compare a listing/ }).click();
      await page.getByRole("textbox", { name: "Item price" }).fill("49.99");
      await page.getByRole("textbox", { name: "Shipping cost" }).fill("5");
      await page.getByRole("button", { name: "Save offer" }).click();
      await page.getByText("$54.99", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Remove navy jacket" }).click();
    },
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1420, 10);
  await page.screenshot({ path: "/tmp/orbit-v31-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(389, 10);
  await page.screenshot({ path: "/tmp/orbit-v31-mobile.png", fullPage: true });
  await check("no browser runtime errors", () => assert.deepEqual(errors, []));
  console.log(`${passed} visual and greeting checks passed.`);
} finally {
  await browser.close();
}
