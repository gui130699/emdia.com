import { parseCsvAmount } from "./csvParser";

export interface QifTransaction {
  date: string; // ISO yyyy-MM-dd
  amount: number; // signed
  payee?: string;
  memo?: string;
}

export interface ParsedQif {
  accountType?: string;
  transactions: QifTransaction[];
}

/** QIF dates are notoriously ambiguous (locale-dependent, occasionally
 * using "'" as a century separator like 1/15'26). This handles the common
 * US convention (MM/DD/YYYY) that most QIF exporters use, plus ISO and
 * DD/MM/YYYY as a fallback when the first segment can't be a month. */
function parseQifDate(raw: string): string | undefined {
  const cleaned = raw.trim().replace("'", "/20");
  const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const parts = cleaned.split(/[/-]/);
  if (parts.length !== 3) return undefined;
  let [a, b, y] = parts;
  if (y.length === 2) y = `20${y}`;
  const first = Number(a);
  const second = Number(b);
  const [month, day] = first > 12 ? [second, first] : [first, second];
  if (!month || !day || month > 12 || day > 31) return undefined;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses a QIF (Quicken Interchange Format) file — a simple line-oriented
 * text format, so no binary-parsing dependency is needed. */
export function parseQif(raw: string): ParsedQif {
  const lines = raw.split(/\r?\n/);
  const transactions: QifTransaction[] = [];
  let current: Partial<QifTransaction> = {};
  let accountType: string | undefined;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("!Type:") || line.startsWith("!type:")) {
      accountType = line.slice(6).trim();
      continue;
    }
    const code = line[0];
    const value = line.slice(1).trim();
    switch (code) {
      case "D":
        current.date = parseQifDate(value);
        break;
      case "T":
      case "U":
        current.amount = parseCsvAmount(value);
        break;
      case "P":
        current.payee = value;
        break;
      case "M":
        current.memo = value;
        break;
      case "^":
        if (current.date && current.amount !== undefined) {
          transactions.push({ date: current.date, amount: current.amount, payee: current.payee, memo: current.memo });
        }
        current = {};
        break;
      default:
        break;
    }
  }

  return { accountType, transactions };
}
