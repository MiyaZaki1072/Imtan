/** UTF-8 byte order mark: Excel and Google Sheets need it to read Thai correctly. */
export const CSV_BOM = '﻿';

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Quote anything with a comma, quote or line break; double the quotes inside.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV file as text: BOM, header row, then one line per row. */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(cell).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}
