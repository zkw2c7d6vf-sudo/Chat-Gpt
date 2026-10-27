/** Orbit immersive Home browser acceptance checks. Run with npm run dev, then npm run test:home. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = (process.env.ORBIT_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const home = page.locator(".oi-root");
  await home.waitFor();
  assert.equal(await page.locator(".oi-window").count(), 11, "All eleven default widgets render");
  for (const title of ["Email","Continue watching","Weather · 5 days","Spotify","Focus session","Today's priorities"])
    assert.equal(await page.getByRole("toolbar", { name: `Move ${title}` }).count(), 1, title);
  assert.equal(await page.getByText("Edit layout").count(), 0);
  await page.getByRole("button", { name: "Minimize Email" }).click();
  assert.equal(await page.locator(".oi-dock button").filter({hasText:"Email"}).count(), 1, "Minimized Email appears in dock");
  await page.locator(".oi-dock button").filter({hasText:"Email"}).click();
  assert.equal(await page.getByRole("toolbar", { name: "Move Email" }).count(), 1);
  await page.getByRole("button", { name: "Close Continue watching" }).click();
  assert.equal(await page.getByRole("toolbar", { name: "Move Continue watching" }).count(), 0);
  await page.getByRole("button", { name: "Widgets", exact: true }).click();
  await page.locator(".oi-widget-entry").filter({hasText:"Continue watching"}).getByRole("button", {name:"Show"}).click();
  await page.getByRole("button", { name: "Close widgets" }).click();
  assert.equal(await page.getByRole("toolbar", { name: "Move Continue watching" }).count(), 1);
  await page.getByRole("button", { name: "Backgrounds" }).click();
  await page.getByRole("button", { name: /Built-in scenes/ }).click();
  await page.getByRole("textbox", {name:"Search backgrounds"}).fill("Aurora");
  assert.equal(await page.locator(".oi-scene-option").count(), 1, "Preset background search filters");
  await page.locator(".oi-scene-option").first().click();
  assert.match(await page.locator(".oi-scene-credit").innerText(), /Aurora/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".oi-root").waitFor();
  assert.match(await page.locator(".oi-scene-credit").innerText(), /Aurora/, "Chosen scene survives reload");
  assert.equal(await page.locator(".oi-window").count(), 11, "Widget state persists");
  console.log("PASS immersive Home workspace controls and background search");
  if (errors.length) throw Error("Page errors: "+errors.join("; "));
} finally {
  await browser.close();
}
