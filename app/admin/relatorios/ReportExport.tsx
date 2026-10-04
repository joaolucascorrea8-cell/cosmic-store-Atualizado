"use client";
import { exportCsv } from "@/lib/product-csv";
export default function ReportExport({
  rows,
  period,
}: {
  rows: unknown[][];
  period: string;
}) {
  return (
    <button
      className="btn-secondary"
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([exportCsv(rows)], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio-cosmic-${period}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      Exportar produtos em CSV
    </button>
  );
}
