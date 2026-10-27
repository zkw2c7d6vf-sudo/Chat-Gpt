import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  timezoneId: "America/New_York",
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.ORBIT_URL || "http://127.0.0.1:5173", {
    waitUntil: "networkidle",
  });
  assert.equal(await page.locator(".oi-window").count(), 3);
  assert.equal(await page.locator(".scene-landscape").count(), 1);
  assert.equal(await page.locator(".page-heading").isVisible(), false);
  assert.equal(
    await page
      .locator(".sidebar")
      .evaluate((e) => Math.round(e.getBoundingClientRect().width)),
    78,
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight),
    900,
    "Desktop scene should fit one screen",
  );
  const old = {
    version: 1,
    space: "Today",
    scene: {
      id: "preset-aurora",
      title: "Aurora",
      category: "Space",
      background: "linear-gradient(#123,#456)",
    },
    spaces: {},
  };
  await page.evaluate(
    (value) =>
      localStorage.setItem("orbit-immersive-home-v1", JSON.stringify(value)),
    old,
  );
  await page
    .getByRole("button", { name: "Open Quick notes", exact: true })
    .click();
  await page
    .getByLabel("Quick notes", { exact: true })
    .fill("A note kept through the rebuild");
  await page
    .getByRole("button", { name: "Minimize Quick notes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Quick notes", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Quick notes", { exact: true }).inputValue(),
    "A note kept through the rebuild",
  );
  await page
    .getByRole("button", { name: "Close Quick notes", exact: true })
    .click();
  for (const [space, count] of [
    ["Study", 3],
    ["Focus", 2],
    ["Unwind", 2],
    ["Today", 3],
  ]) {
    await page.getByRole("button", { name: space, exact: true }).click();
    assert.equal(await page.locator(".oi-window").count(), count);
  }
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".oi-window").count(), 3);
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("orbit-immersive-home-v1")),
    ),
    old,
  );
  const backup = await page.evaluate(async () => {
    const { createBackup, parseBackup } = await import("/src/backup.ts");
    return parseBackup(JSON.stringify(createBackup(localStorage)));
  });
  assert(backup.data["orbit-home-scene-v2"]);
  assert(backup.data["orbit-immersive-home-v1"]);
  mkdirSync("docs/previews", { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/previews/home-rebuild-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    await page
      .getByRole("button", { name: "Open Quick notes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Maximize Quick notes", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Quick notes", { exact: true }).inputValue(),
      "A note kept through the rebuild",
    );
    await page
      .getByRole("button", { name: "Restore Quick notes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close Quick notes", exact: true })
      .click();
    if (width === 390) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: "docs/previews/home-rebuild-mobile.png",
        fullPage: true,
      });
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS scene-first defaults, one-screen desktop, dock controls, contextual spaces, old-layout preservation, backup, responsive views and screenshots",
  );
} finally {
  await browser.close();
}
