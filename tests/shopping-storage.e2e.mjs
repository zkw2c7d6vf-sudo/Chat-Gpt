import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.ORBIT_URL || "http://127.0.0.1:5173";
const expectCrash = process.env.ORBIT_EXPECT_CRASH === "1";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("orbit-seed-v2", "true");
  localStorage.setItem("orbit-seed-v3", "true");
  localStorage.setItem("orbit-tasks", "[]");
});
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/connections")
    await route.fulfill({
      json: {
        google: { configured: false, connected: false },
        spotify: { configured: false, connected: false },
        calendar: { connected: false },
        assistant: { configured: false },
      },
    });
  else if (path === "/api/dashboard")
    await route.fulfill({
      json: { calendar: [], emails: [], files: [], spotify: null, errors: [] },
    });
  else if (path === "/api/shopping/feed")
    await route.fulfill({
      status: 503,
      json: { error: "Shopping fixture is temporarily unavailable." },
    });
  else await route.fulfill({ json: {} });
});
try {
  await page.goto(base);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Shopping Scout", exact: true })
    .click();
  await page.getByPlaceholder("Add something you want to find").waitFor();
  await page.evaluate(() => {
    window.__shoppingBlocked = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__shoppingBlocked && key.startsWith("orbit-shopping-"))
        throw new DOMException("Quota fixture", "QuotaExceededError");
      return original.call(this, key, value);
    };
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await page
    .getByPlaceholder("Add something you want to find")
    .fill("Desk & lamp");
  await page
    .getByRole("button", { name: "Save shopping search", exact: true })
    .click();
  if (expectCrash) {
    await page.waitForFunction(
      () => !document.querySelector(".shopping-scout"),
    );
    assert(errors.some((error) => error.includes("Quota fixture")));
    console.log(
      "CONFIRMED baseline: adding a saved search with a quota exception unmounts Orbit. This reproduces a storage-triggered crash, not every possible user-device trigger.",
    );
  } else {
    await page.getByRole("button", { name: "Retry saving shopping" }).waitFor();
    assert.equal(errors.length, 0);
    assert.equal(await page.locator(".shopping-saved article").count(), 1);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("orbit-shopping-searches-v1"),
      ),
      null,
    );
    await page.evaluate(() => {
      window.__shoppingBlocked = false;
    });
    await page.getByRole("button", { name: "Retry saving shopping" }).click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("orbit-shopping-searches-v1")).length,
      ),
      1,
    );
    const link = await page
      .locator(".retailer-links a")
      .first()
      .getAttribute("href");
    assert(link.includes("Desk%20%26%20lamp"));
    await page
      .getByPlaceholder("Add something you want to find")
      .fill(" desk & LAMP ");
    await page
      .getByRole("button", { name: "Save shopping search", exact: true })
      .click();
    assert.equal(await page.locator(".shopping-saved article").count(), 1);
    assert(
      await page
        .getByRole("button", { name: "Save shopping search", exact: true })
        .isDisabled(),
    );
    await page
      .getByRole("button", { name: "Compare a listing", exact: true })
      .click();
    await page.getByLabel("Item price", { exact: true }).fill("25");
    await page.getByLabel("Shipping cost").fill("4");
    await page.evaluate(() => {
      window.__shoppingBlocked = true;
    });
    await page.getByRole("button", { name: "Save offer", exact: true }).click();
    await page.getByRole("button", { name: "Retry saving shopping" }).waitFor();
    assert.equal(errors.length, 0);
    await page.evaluate(() => {
      window.__shoppingBlocked = false;
    });
    await page.getByRole("button", { name: "Retry saving shopping" }).click();
    await page.reload();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Shopping Scout", exact: true })
      .click();
    await page.locator(".shopping-saved article").waitFor();
    assert.equal(await page.locator(".shopping-saved article").count(), 1);
    assert(
      (await page.locator(".shopping-saved").innerText()).includes("$29.00"),
    );
    await page
      .getByText("Shopping fixture is temporarily unavailable.", {
        exact: true,
      })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS Shopping storage failure: search/offer quota exceptions stay recoverable; retry and reload retain records; duplicate/blank input, LAN ID fallback, encoded links and failed API remain usable.",
    );
  }
} finally {
  await context.close();
  await browser.close();
}
