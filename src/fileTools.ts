/** Text conversions run locally; quoted delimiters and newlines round-trip. */
export function parseCsv(text: string): Record<string, string>[] {
  if (text.length > 2 * 1024 * 1024)
    throw new Error("Choose CSV text smaller than 2 MiB.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    afterQuote = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += char;
      continue;
    }
    if (afterQuote && ![",", "\r", "\n"].includes(char))
      throw new Error("Unexpected text after a quoted CSV field.");
    if (char === '"') {
      if (field)
        throw new Error("Quotes must start at the beginning of a CSV field.");
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
      afterQuote = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      afterQuote = false;
    } else field += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  if (field || row.length || afterQuote) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length || !rows[0].some(Boolean))
    throw new Error("CSV needs a header row.");
  const headers = rows.shift()!;
  if (
    headers.some((value) => !value.trim()) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("CSV column names must be nonempty and unique.");
  return rows
    .filter((values) => values.length > 1 || values[0] !== "")
    .map((values) => {
      if (values.length !== headers.length)
        throw new Error(
          "Each CSV row must have the same number of fields as the header.",
        );
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index]]),
      );
    });
}
export function jsonToCsv(text: string): string {
  const values: unknown = JSON.parse(text);
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.some(
      (value) => !value || typeof value !== "object" || Array.isArray(value),
    )
  )
    throw new Error("Use a nonempty JSON array of objects to create CSV.");
  const headers = [...new Set(values.flatMap((value) => Object.keys(value)))];
  if (!headers.length) throw new Error("JSON objects need at least one field.");
  const cell = (value: unknown) => {
    const raw =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
  };
  return [
    headers.map(cell).join(","),
    ...values.map((value) =>
      headers
        .map((header) =>
          cell(Object.hasOwn(value, header) ? value[header] : ""),
        )
        .join(","),
    ),
  ].join("\r\n");
}
export function convertText(
  text: string,
  mode: string,
): { text: string; extension: string; type: string } {
  if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024)
    throw new Error("Choose text smaller than 2 MiB.");
  if (mode === "csv-json")
    return {
      text: JSON.stringify(parseCsv(text), null, 2),
      extension: "json",
      type: "application/json",
    };
  if (mode === "json-csv")
    return { text: jsonToCsv(text), extension: "csv", type: "text/csv" };
  if (mode === "format-json" || mode === "minify-json")
    return {
      text: JSON.stringify(
        JSON.parse(text),
        null,
        mode === "format-json" ? 2 : undefined,
      ),
      extension: "json",
      type: "application/json",
    };
  throw new Error("Choose a supported conversion.");
}
