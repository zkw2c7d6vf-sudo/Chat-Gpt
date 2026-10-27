import test from "node:test";
import assert from "node:assert/strict";
import { csvText } from "../src/exports.ts";
import { parseCsv } from "../src/fileTools.ts";
test("CSV exports preserve quotes, newlines, Unicode and numeric amounts", () => {
  const text = csvText([
    ["Description", "Amount"],
    ['Groceries, café "A"\nreceipt', -12.34],
  ]);
  assert.deepEqual(parseCsv(text), [
    { Description: 'Groceries, café "A"\nreceipt', Amount: "-12.34" },
  ]);
});
test("CSV exports neutralize spreadsheet formulas in user text", () => {
  const result = parseCsv(
    csvText([
      ["Value"],
      ['=HYPERLINK("https://example.org")'],
      ["  +SUM(A1:A2)"],
      ["@command"],
      ["-formula"],
    ]),
  );
  assert(result.every((row) => row.Value.startsWith("'")));
});
