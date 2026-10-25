#!/usr/bin/env node
// Run from a freshly extracted V3 download. Copies only application files.
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, realpath } from "node:fs/promises";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const source = await realpath(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: node scripts/update-local.mjs [existing-Orbit-folder] [--copy-only]\nRun from the NEW download. Stop the old server first. Your .env, .orbit, Git history and browser data are preserved.",
  );
  process.exit(0);
}
let targetArg = args.find((x) => !x.startsWith("--"));
if (!targetArg) {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log("Stop Orbit first with Control + C in its server Terminal.");
    targetArg = await terminal.question(
      "Drag your EXISTING Orbit folder into this Terminal, then press Enter: ",
    );
  } finally {
    terminal.close();
  }
}
function draggedPath(value) {
  let text = value.trim();
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"'))
  )
    text = text.slice(1, -1);
  return text.replace(/\\(.)/g, "$1");
}
try {
  if (!targetArg?.trim())
    throw new Error("No folder was selected. Nothing was changed.");
  const target = await realpath(resolve(draggedPath(targetArg)));
  if (
    target === source ||
    source.startsWith(target + sep) ||
    target.startsWith(source + sep)
  )
    throw new Error(
      "Choose the old Orbit folder, separate from this new download.",
    );
  const manifest = JSON.parse(
    await readFile(join(target, "package.json"), "utf8"),
  );
  if (manifest.name !== "orbit-personal-dashboard")
    throw new Error(
      "This is not an Orbit project folder. Nothing was changed.",
    );
  const files = [
    "src",
    "public",
    "server",
    "tests",
    "docs",
    "scripts",
    "index.html",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "README.md",
    ".gitignore",
    ".env.example",
  ];
  // No directory-wide copying: .env, .orbit, .git, node_modules and user files
  // outside this explicit application-file list are never copied or removed.
  for (const name of files) {
    const from = join(source, name);
    if (existsSync(from)) {
      await mkdir(target, { recursive: true });
      await cp(from, join(target, name), {
        recursive: true,
        force: true,
        dereference: false,
        filter: (entry) =>
          ![".env", ".orbit", ".git", "node_modules"].includes(
            entry.split(sep).at(-1),
          ),
      });
    }
  }
  console.log(
    "V3 application files copied. Existing credentials and connection storage were preserved.",
  );
  if (!args.includes("--copy-only")) {
    execFileSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      [
        "ci",
        "--cache",
        join(tmpdir(), "orbit-npm-cache"),
        "--no-audit",
        "--no-fund",
      ],
      { cwd: target, stdio: "inherit" },
    );
  }
  console.log(
    `\nUpdate complete. In your OLD Orbit folder, run: npm run dev\nKeep using the same browser address to retain your notes, tasks and Spotify browser session.`,
  );
} catch (error) {
  console.error(`Update stopped: ${error.message}`);
  process.exitCode = 1;
}
