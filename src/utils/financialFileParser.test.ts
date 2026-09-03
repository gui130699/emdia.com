import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFinancialFile } from "./financialFileParser";

function localFile(name: string, bytes: Uint8Array | ArrayBuffer): File {
  return {
    name,
    arrayBuffer: async () => bytes instanceof ArrayBuffer
      ? bytes
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  } as File;
}

describe("financial file detection", () => {
  it("trusts OFX content over a misleading extension", async () => {
    const file = localFile("extrato.csv", new TextEncoder().encode("OFXHEADER:100\n<OFX></OFX>"));
    expect((await parseFinancialFile(file)).format).toBe("ofx");
  });

  it("decodes a structured Windows-1252 TXT export", async () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("Data;Descri"), 0xe7, 0xe3,
      ...new TextEncoder().encode("o;Valor\n01/08/2026;Caf"), 0xe9,
      ...new TextEncoder().encode(";-10,00"),
    ]);
    const parsed = await parseFinancialFile(localFile("extrato.txt", bytes));
    expect(parsed.format).toBe("txt");
    expect(parsed.tabular?.headers[1]).toBe("Descrição");
  });

  it("opens a real XLSX workbook and chooses its populated sheet", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Data", "Descrição", "Valor"], ["01/08/2026", "Compra", -10]]), "Extrato");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const parsed = await parseFinancialFile(localFile("dados.bin", bytes));
    expect(parsed.format).toBe("xlsx");
    expect(parsed.sheetName).toBe("Extrato");
    expect(parsed.tabular?.rows).toHaveLength(1);
  });
});
