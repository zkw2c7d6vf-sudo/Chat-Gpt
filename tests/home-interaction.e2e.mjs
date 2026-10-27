import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.ORBIT_URL || "http://127.0.0.1:5173", {
    waitUntil: "networkidle",
  });
  const dock = page.getByRole("navigation", { name: "Home tools" });
  assert.equal(await dock.getByRole("button").count(), 6);
  assert.equal(
    await dock
      .getByRole("button", { name: "Open Calendar", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await dock
      .getByRole("button", { name: "Open Recent files", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /background/i })
      .count(),
    0,
  );
  await dock
    .getByRole("button", { name: "Choose background", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Background library" }).waitFor();
  await page.keyboard.press("Escape");
  const search = page.getByRole("button", {
    name: "Search Orbit",
    exact: true,
  });
  assert(await search.isVisible());
  assert.equal(
    await search.evaluate((el) => getComputedStyle(el).borderTopStyle),
    "solid",
  );
  assert((await search.boundingBox()).width > 120);
  await search.click();
  await page.getByRole("textbox", { name: "Search everything" }).waitFor();
  await page.keyboard.press("Escape");
  // A large local scene must never be serialized once per pointer sample.
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext("2d"),
      pixels = ctx.createImageData(600, 400);
    let seed = 123;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const state = JSON.parse(localStorage.getItem("orbit-home-scene-v2"));
    state.scene = {
      id: "custom",
      title: "Local test image",
      category: "My images",
      background: canvas.toDataURL("image/png"),
    };
    localStorage.setItem("orbit-home-scene-v2", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start focus", exact: true }).click();
  await page.evaluate(() => {
    window.moveWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, ...args) {
      if (key === "orbit-home-scene-v2") window.moveWrites++;
      return original.call(this, key, ...args);
    };
    window.panelNodes = [...document.querySelectorAll(".oi-window")];
    window.panelOrder = window.panelNodes.map((el) => el.dataset.widgetId);
    window.longTasks = [];
    try {
      new PerformanceObserver((list) =>
        window.longTasks.push(
          ...list.getEntries().map((item) => item.duration),
        ),
      ).observe({ entryTypes: ["longtask"] });
    } catch {}
  });
  const panel = page.locator("[data-widget-id=upnext]"),
    bar = panel.getByRole("toolbar");
  const bounds = await bar.boundingBox();
  const original = await panel.evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
  }));
  await page.mouse.move(bounds.x + 50, bounds.y + 20);
  await page.mouse.down();
  await page.evaluate(() => {
    window.contentChanges = 0;
    const observer = new MutationObserver((records) => {
      window.contentChanges += records.length;
    });
    document
      .querySelectorAll(".oi-window-body")
      .forEach((node) =>
        observer.observe(node, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        }),
      );
  });
  await page.mouse.move(bounds.x + 930, bounds.y + 170, { steps: 90 });
  assert.equal(
    await page.evaluate(() => window.moveWrites),
    0,
    "No storage writes during overlap movement",
  );
  assert.equal(
    await panel.evaluate((el) => el.style.left),
    original.left,
    "Movement must not repeatedly lay out left/top",
  );
  assert.match(await panel.evaluate((el) => el.style.transform), /translate3d/);
  assert.equal(
    await panel.evaluate((el) => getComputedStyle(el).backdropFilter),
    "none",
  );
  assert(
    await page.evaluate(() =>
      window.panelNodes.every(
        (node, index) =>
          document.querySelectorAll(".oi-window")[index] === node,
      ),
    ),
    "Raising a window must not reorder mounted panels",
  );
  assert.equal(
    await page.evaluate(() => window.contentChanges),
    0,
    "Running Focus must not repaint panel contents during a drag",
  );
  await page.mouse.up();
  await page.waitForFunction(() => window.moveWrites === 1);
  const moved = await panel.evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
  }));
  assert.notEqual(moved.left, original.left);
  assert.equal(await panel.evaluate((el) => el.style.transform), "");
  assert.equal(await page.locator(".oi-root[data-manipulating]").count(), 0);
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(
    await panel.evaluate((el) => ({ left: el.style.left, top: el.style.top })),
    moved,
  );
  // Escape and pointer cancellation must discard partial geometry and leave controls usable.
  let box = await bar.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y + 80, { steps: 20 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(
    await panel.evaluate((el) => ({ left: el.style.left, top: el.style.top })),
    moved,
  );
  const grip = panel.getByRole("slider");
  box = await grip.boundingBox();
  const initialSize = await panel.evaluate((el) => ({
    width: el.style.width,
    height: el.style.height,
  }));
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + 90, { steps: 20 });
  await grip.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  assert.deepEqual(
    await panel.evaluate((el) => ({
      width: el.style.width,
      height: el.style.height,
    })),
    initialSize,
  );
  assert.equal(await page.locator(".oi-root[data-manipulating]").count(), 0);
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await search.isVisible());
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    await search.click();
    await page.getByRole("textbox", { name: "Search everything" }).waitFor();
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS overlap dragging: zero in-gesture storage writes, one drop save, stable mounted order, transforms, cancellation, reload, concise dock and boxed search on desktop/tablet/mobile",
  );
} finally {
  await browser.close();
}
