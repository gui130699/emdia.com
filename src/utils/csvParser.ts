export interface ParsedCsv {
  delimiter: "," | ";";
  headers: string[];
  rows: string[][];
}

/** Splits a single CSV line respecting double-quoted fields (which may
 * contain the delimiter or escaped `""`). */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function detectDelimiter(headerLine: string): "," | ";" {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

/** Parses raw CSV text (UTF-8, accents preserved) into headers + rows.
 * Supports both `;` (common in Brazilian bank exports) and `,` delimiters,
 * auto-detected from the header line. */
export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { delimiter: ";", headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => splitLine(line, delimiter));

  return { delimiter, headers, rows };
}

/** Parses a Brazilian-formatted (dd/MM/yyyy) or ISO (yyyy-MM-dd) date string
 * into an ISO yyyy-MM-dd value. Returns undefined if unrecognized. */
export function parseCsvDate(value: string): string | undefined {
  const trimmed = value.trim();
  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return undefined;
}

/** Parses a numeric string that may use comma or dot as the decimal
 * separator, and dot/comma/space as a thousands separator. */
export function parseCsvAmount(value: string): number | undefined {
  let cleaned = value.trim().replace(/[R$\s]/g, "");
  if (!cleaned) return undefined;
  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith("-");
  cleaned = cleaned.replace(/^[-()]|\)$/g, "");

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    cleaned = cleaned.replace(/,/g, "");
  }

  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return undefined;
  return negative ? -parsed : parsed;
}
