
import { FuelRow } from "../types";

export function convertToCSV(rows: FuelRow[]): string {
  const headers = ["Date", "Address", "Length", "+r", "r-", "Bow", "Δ Bow", "Δ Length", "Go-No Go", "Notes"];
  const csvRows = [
    headers.join(","),
    ...rows.map(row => [
      `"${row.date || ''}"`,
      `"${row.address || ''}"`,
      `"${row.length || ''}"`,
      `"${row.plus_r || ''}"`,
      `"${row.minus_r || ''}"`,
      `"${row.bow || ''}"`,
      `"${row.delta_bow || ''}"`,
      `"${row.delta_length || ''}"`,
      `"${row.go_no_go || ''}"`,
      `"${row.notes || ''}"`
    ].join(","))
  ];
  return csvRows.join("\n");
}

export function downloadCSV(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
