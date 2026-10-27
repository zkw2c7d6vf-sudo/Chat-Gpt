import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const contract = JSON.parse(
  readFileSync(
    new URL("../docs/home-widget-expansion-contract.json", import.meta.url),
    "utf8",
  ),
);

test("every Home widget is represented by a compact/expanded content contract", () => {
  const from = app.search(/<ImmersiveHome\b/);
  const until = app.indexOf("<WeeklyPlanner", from);
  assert.ok(
    from >= 0 && until > from,
    "find the actual Home widget registration",
  );
  const ids = [
    ...app.slice(from, until).matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*title:/g),
  ].map((m) => m[1]);
  assert.equal(ids.length, 11, "the current eleven Home widget definitions");
  assert.equal(new Set(ids).size, ids.length, "unique widget identifiers");
  assert.equal(
    new Set(contract.widgets.map((x) => x.id)).size,
    contract.widgets.length,
    "unique manifest identifiers",
  );
  assert.deepEqual(
    ids.slice().sort(),
    contract.widgets.map((x) => x.id).sort(),
    "every registered widget must have a dynamic expansion specification",
  );
  for (const w of contract.widgets) {
    for (const key of [
      "id",
      "title",
      "dataSource",
      "compact",
      "expanded",
      "assertion",
      "privacy",
    ]) {
      assert.equal(typeof w[key], "string", `${w.id} missing ${key}`);
      assert.ok(w[key].trim().length > 0, `${w.id} blank ${key}`);
      if (["compact", "expanded", "assertion", "privacy"].includes(key))
        assert.ok(w[key].length > 12, `${w.id} vague ${key}`);
    }
    for (const state of ["loading", "ready", "empty", "disconnected", "error"])
      assert.ok(w.states.includes(state), `${w.id} missing ${state} behavior`);
    for (const action of [
      "maximize",
      "restore",
      "minimize",
      "reopen",
      "close",
      "show",
      "resize",
      "move",
    ])
      assert.ok(
        w.requiredActions.includes(action),
        `${w.id} missing ${action} contract`,
      );
    assert.notEqual(
      w.compact,
      w.expanded,
      `${w.id} expansion must change the visible content`,
    );
  }
});
