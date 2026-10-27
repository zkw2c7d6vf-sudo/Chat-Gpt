/** Local downloads: no account data is sent to a service. */
export function csvText(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          // Keep user text from becoming an executable spreadsheet formula.
          const text =
            typeof value === "string" && /^[\s]*[=+@-]/.test(value)
              ? `'${value}`
              : String(value);
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  downloadText(name, csvText(rows), "text/csv;charset=utf-8");
}
