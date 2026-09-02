function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const str = String(value);
    return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(";"));
  downloadBlob("﻿" + lines.join("\n"), filename, "text/csv;charset=utf-8;");
}

export async function exportToPdf(title: string, headers: string[], rows: (string | number)[][], subtitle?: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 25);
  }
  autoTable(doc, {
    startY: subtitle ? 30 : 24,
    head: [headers],
    body: rows.map((row) => row.map(String)),
    headStyles: { fillColor: [5, 150, 105] },
    styles: { fontSize: 9 },
  });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
