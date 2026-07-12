"use client";

import * as React from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PatientWithStage } from "@/lib/types/domain";

const columns: ColumnDef<PatientWithStage>[] = [
  { accessorKey: "hospital_number", header: "Hospital Number" },
  { accessorKey: "procedure", header: "Procedure" },
  { accessorKey: "consultant", header: "Consultant" },
  { accessorKey: "specialty", header: "Specialty" },
  { accessorKey: "cepod_priority", header: "Priority" },
  { accessorFn: (row) => row.cancelled ? "Cancelled" : row.completed_at || row.current_stage === "patient-out-of-recovery" ? "Completed" : "Active", id: "status", header: "Status" },
  { accessorFn: (row) => formatRecordDate(row.cancelled_at ?? row.completed_at), id: "recordedDate", header: "Completed / cancelled" },
  { accessorFn: (row) => row.cancellation_reason ?? "—", id: "cancellationReason", header: "Cancellation reason" },
  { accessorFn: (row) => row.stage.name, id: "stage", header: "Current Stage" },
  { accessorKey: "elapsed_minutes", header: "Elapsed Minutes" },
  { accessorKey: "delay_status", header: "Delay Status" }
];

export function PatientReportTable({ patients }: { patients: PatientWithStage[] }) {
  const table = useReactTable({ data: patients, columns, getCoreRowModel: getCoreRowModel() });
  const rows = patients.map((patient) => ({
    hospital_number: patient.hospital_number,
    procedure: patient.procedure,
    consultant: patient.consultant,
    specialty: patient.specialty,
    priority: patient.cepod_priority,
    status: patient.cancelled ? "Cancelled" : patient.completed_at || patient.current_stage === "patient-out-of-recovery" ? "Completed" : "Active",
    completed_or_cancelled_at: patient.cancelled_at ?? patient.completed_at ?? "",
    cancellation_reason: patient.cancellation_reason ?? "",
    current_stage: patient.stage.name,
    elapsed_minutes: patient.elapsed_minutes,
    delay_status: patient.delay_status
  }));

  function exportCsv() {
    const csv = [
      Object.keys(rows[0] ?? {}).join(","),
      ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    ].join("\n");
    download(new Blob([csv], { type: "text/csv" }), "theatreflow-report.csv");
  }

  function exportExcel() {
    const header = Object.keys(rows[0] ?? {});
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead><tr>${header.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows
                .map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(String(value))}</td>`).join("")}</tr>`)
                .join("")}
            </tbody>
          </table>
        </body>
      </html>`;
    download(new Blob([html], { type: "application/vnd.ms-excel" }), "theatreflow-report.xls");
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.text("Theatreflow CEPOD Report", 14, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Hospital", "Procedure", "Consultant", "Priority", "Stage", "Elapsed", "Delay"]],
      body: rows.map((row) => [
        row.hospital_number,
        row.procedure,
        row.consultant,
        row.priority,
        row.current_stage,
        `${row.elapsed_minutes}m`,
        row.delay_status
      ])
    });
    doc.save("theatreflow-report.pdf");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Audit export</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={exportExcel}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Excel
            </Button>
            <Button type="button" onClick={exportPdf}>
              <Download className="h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-3 text-left font-semibold">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRecordDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
