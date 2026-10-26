import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const script = resolve("scripts/update-local.mjs");
test("ZIP updater refreshes application code while preserving credentials, connections and personal files", async () => {
  const folder = await mkdtemp(join(tmpdir(), "orbit update fixture "));
  try {
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({ name: "orbit-personal-dashboard", version: "1.0.0" }),
    );
    await writeFile(join(folder, ".env"), "UPDATER_TEST_CANARY=keep-local\n");
    await mkdir(join(folder, ".orbit"));
    await writeFile(
      join(folder, ".orbit", "connections.json"),
      "fixture connections",
    );
    await mkdir(join(folder, ".git"));
    await writeFile(join(folder, ".git", "sentinel"), "local history");
    await writeFile(join(folder, "personal.txt"), "personal file");
    execFileSync(process.execPath, [script, folder, "--copy-only"]);
    assert.equal(
      JSON.parse(await readFile(join(folder, "package.json"), "utf8")).version,
      "4.0.0",
    );
    assert.equal(
      await readFile(join(folder, ".env"), "utf8"),
      "UPDATER_TEST_CANARY=keep-local\n",
    );
    assert.equal(
      await readFile(join(folder, ".orbit", "connections.json"), "utf8"),
      "fixture connections",
    );
    assert.equal(
      await readFile(join(folder, ".git", "sentinel"), "utf8"),
      "local history",
    );
    assert.equal(
      await readFile(join(folder, "personal.txt"), "utf8"),
      "personal file",
    );
    assert.equal(
      await readFile(join(folder, "src", "App.tsx"), "utf8"),
      await readFile(resolve("src", "App.tsx"), "utf8"),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("ZIP updater rejects an unrelated folder without writing files", async () => {
  const folder = await mkdtemp(join(tmpdir(), "orbit-unrelated-"));
  try {
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({ name: "another-app" }),
    );
    const run = spawnSync(process.execPath, [script, folder, "--copy-only"], {
      encoding: "utf8",
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /not an Orbit project/);
    assert.equal(
      JSON.parse(await readFile(join(folder, "package.json"), "utf8")).name,
      "another-app",
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("ZIP updater refuses to overwrite its own download", () => {
  const run = spawnSync(
    process.execPath,
    [script, resolve("."), "--copy-only"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /separate from this new download/);
});

test("V3 updater protects an existing V2 installation", async () => {
  const folder = await mkdtemp(join(tmpdir(), "orbit-v2-protected-"));
  try {
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({ name: "orbit-personal-dashboard", version: "2.0.0" }),
    );
    const run = spawnSync(process.execPath, [script, folder, "--copy-only"], {
      encoding: "utf8",
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /V2 is protected/);
    assert.equal(
      JSON.parse(await readFile(join(folder, "package.json"), "utf8")).version,
      "2.0.0",
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
