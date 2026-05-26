import type { ExportDatasetRow } from '../contracts/export.contracts';
import { EXPORT_BLOCKED_FIELDS } from '../contracts/export.contracts';

/**
 * Strips any blocked/sensitive field keys from a row object.
 * Works on a flat key-value map.
 */
export function sanitizeRow(row: Record<string, unknown>): ExportDatasetRow {
  const result: ExportDatasetRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (EXPORT_BLOCKED_FIELDS.includes(key)) continue;
    if (value === undefined || value === null) {
      result[key] = null;
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    } else {
      // Collapse complex nested objects to string representation
      result[key] = JSON.stringify(value);
    }
  }
  return result;
}

/**
 * Returns a sorted, deduplicated header array from an array of rows.
 */
export function extractHeaders(rows: ExportDatasetRow[]): string[] {
  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headerSet.add(key);
    }
  }
  return Array.from(headerSet).sort();
}

/**
 * Escape a CSV field value: wrap in quotes if it contains comma, quote, or newline.
 */
function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from an array of sanitized rows.
 * First line is the header. CRLF line endings per RFC 4180.
 */
export function buildCsv(rows: ExportDatasetRow[]): string {
  if (rows.length === 0) return '';
  const headers = extractHeaders(rows);
  const lines: string[] = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    const cells = headers.map((h) => escapeCsvField(row[h]));
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}

/**
 * Build a JSON string from an array of sanitized rows.
 * Pretty-printed with 2-space indent. Deterministic key order.
 */
export function buildJson(rows: ExportDatasetRow[]): string {
  return JSON.stringify(rows, null, 2);
}
