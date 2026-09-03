import * as XLSX from "xlsx";
import { parseCsv, type ParsedCsv } from "./csvParser";

export type FinancialFileFormat = "ofx" | "csv" | "xls" | "xlsx" | "qif" | "txt";

export interface ParsedFinancialFile {
  format: FinancialFileFormat;
  text?: string;
  tabular?: ParsedCsv;
  sheetName?: string;
}

function decodeFinancialText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function extensionOf(name: string): FinancialFileFormat | undefined {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  return ext && ["ofx", "csv", "xls", "xlsx", "qif", "txt"].includes(ext)
    ? (ext as FinancialFileFormat)
    : undefined;
}

function binarySpreadsheetFormat(bytes: Uint8Array): "xls" | "xlsx" | undefined {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "xlsx";
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "xls";
  return undefined;
}

function parseWorkbook(buffer: ArrayBuffer): { tabular: ParsedCsv; sheetName: string } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const candidates = workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
      dateNF: "dd/mm/yyyy",
    });
    const normalized = rows
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some(Boolean));
    return { sheetName, normalized };
  }).sort((a, b) => b.normalized.length - a.normalized.length);

  const selected = candidates[0];
  if (!selected || selected.normalized.length < 2) {
    throw new Error("A planilha não contém uma tabela financeira reconhecível.");
  }
  return {
    sheetName: selected.sheetName,
    tabular: { delimiter: ";", headers: selected.normalized[0], rows: selected.normalized.slice(1) },
  };
}

/** Detects the real payload before trusting the filename. Text files are
 * decoded as strict UTF-8 first and fall back to Windows-1252, common in
 * Brazilian banking exports. */
export async function parseFinancialFile(file: File): Promise<ParsedFinancialFile> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const spreadsheet = binarySpreadsheetFormat(bytes);
  if (spreadsheet) {
    const parsed = parseWorkbook(buffer);
    return { format: spreadsheet, ...parsed };
  }

  const text = decodeFinancialText(buffer).replace(/^\uFEFF/, "");
  const probe = text.slice(0, 4096).trimStart();
  if (/^(OFXHEADER:|<\?xml[\s\S]*?<OFX\b|<OFX\b)/i.test(probe)) return { format: "ofx", text };
  if (/^!Type:/im.test(probe)) return { format: "qif", text };

  const tabular = parseCsv(text);
  if (tabular.headers.length > 1 && tabular.rows.length > 0) {
    const fallback = extensionOf(file.name);
    return { format: fallback === "txt" ? "txt" : "csv", text, tabular };
  }
  throw new Error("Formato não reconhecido. Use OFX, CSV, XLS, XLSX, QIF ou TXT estruturado.");
}
