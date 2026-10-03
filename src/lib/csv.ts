// RFC-4180-style CSV parse/serialize with spreadsheet formula-injection protection.

export class CsvError extends Error {}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') {
      if (field.length > 0) throw new CsvError(`Unexpected quote inside an unquoted field (row ${rows.length + 1}).`);
      inQuotes = true; i++; continue;
    }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r" || c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c; i++;
  }
  if (inQuotes) throw new CsvError("A quoted field is never closed.");
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** Prefix cells that a spreadsheet would execute as a formula. */
export function neutralizeFormula(v: string): string {
  return FORMULA_START.test(v) ? `'${v}` : v;
}

export function escapeCell(raw: string): string {
  const v = neutralizeFormula(raw);
  return /[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}
