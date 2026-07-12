"use client";

import * as React from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Download, FilterX } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DelayReason, PatientWithStage, WorkflowEvent } from "@/lib/types/domain";

type DatePreset = "today" | "7d" | "month" | "year" | "custom";
type DelayLength = "all" | "under30" | "30-60" | "60-90" | "90-120" | "120-180" | "over180";
type ReportRow = {
  hospitalNumber: string; procedure: string; specialty: string; consultant: string; priority: string; status: string;
  dateBooked: string; dateBookedKey: string; recordDate: string; cancellationReason: string; delay: "Yes" | "No"; delayReason: string; stagesAffected: string; delayMinutes: number;
};

const columns: ColumnDef<ReportRow>[] = [
  { accessorKey: "hospitalNumber", header: "Hospital number" }, { accessorKey: "procedure", header: "Procedure" },
  { accessorKey: "specialty", header: "Specialty" }, { accessorKey: "consultant", header: "Consultant" },
  { accessorKey: "priority", header: "Priority" }, { accessorKey: "status", header: "Status" },
  { accessorKey: "dateBooked", header: "Date booked" }, { accessorKey: "recordDate", header: "Completed / cancelled date" },
  { accessorKey: "cancellationReason", header: "Cancellation reason" }, { accessorKey: "delay", header: "Delay" },
  { accessorKey: "delayReason", header: "Delay reason" }, { accessorKey: "stagesAffected", header: "Stages affected" }, { accessorKey: "delayMinutes", header: "Delay length (minutes)" }
];
const exportHeaders = columns.map((column) => String(column.header));
const rowValues = (row: ReportRow) => [row.hospitalNumber, row.procedure, row.specialty, row.consultant, row.priority, row.status, row.dateBooked, row.recordDate, row.cancellationReason, row.delay, row.delayReason, row.stagesAffected, row.delayMinutes];
const workflowStageLabels: Record<string, string> = {
  "patient-on-list": "Patient on list", "sent-for": "Patient sent for", "patient-arrived": "Patient arrived in Theatres",
  "anaesthetic-started": "Anaesthetic started", "patient-in-theatre": "Patient in Theatre", "operation-started": "Operation started",
  "operation-finished": "Operation finished", "patient-in-recovery": "Patient in Recovery", "patient-out-of-recovery": "Patient out of Recovery"
};

export function PatientReportTable({ patients, events, delayReasons }: { patients: PatientWithStage[]; events: WorkflowEvent[]; delayReasons: DelayReason[] }) {
  const today = localDateKey(new Date());
  const monthStart = localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [datePreset, setDatePreset] = React.useState<DatePreset>("month");
  const [customStart, setCustomStart] = React.useState(monthStart);
  const [customEnd, setCustomEnd] = React.useState(today);
  const [specialty, setSpecialty] = React.useState("all");
  const [consultant, setConsultant] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [delayReason, setDelayReason] = React.useState("all");
  const [stageAffected, setStageAffected] = React.useState("all");
  const [delayLength, setDelayLength] = React.useState<DelayLength>("all");

  const reasonLabels = React.useMemo(() => new Map(delayReasons.map((reason) => [reason.id, reason.label])), [delayReasons]);
  const allRows = React.useMemo(() => buildRows(patients, events, reasonLabels), [patients, events, reasonLabels]);
  const dateRange = React.useMemo(() => getDateRange(datePreset, customStart, customEnd), [datePreset, customStart, customEnd]);
  const specialties = React.useMemo(() => [...new Set(patients.map((patient) => patient.specialty))].sort(), [patients]);
  const consultants = React.useMemo(() => [...new Set(patients.filter((patient) => specialty === "all" || patient.specialty === specialty).map((patient) => patient.consultant))].sort(), [patients, specialty]);
  const filteredRows = React.useMemo(() => allRows.filter((row) => row.dateBookedKey >= dateRange.start && row.dateBookedKey <= dateRange.end && (specialty === "all" || row.specialty === specialty) && (consultant === "all" || row.consultant === consultant) && (priority === "all" || row.priority === priority) && (delayReason === "all" || row.delayReason.split("\n").includes(reasonLabels.get(delayReason) ?? delayReason)) && (stageAffected === "all" || row.stagesAffected.split("\n").includes(workflowStageLabels[stageAffected] ?? stageAffected)) && matchesDelayLength(row.delayMinutes, delayLength)), [allRows, consultant, dateRange, delayLength, delayReason, priority, reasonLabels, specialty, stageAffected]);
  const table = useReactTable({ data: filteredRows, columns, getCoreRowModel: getCoreRowModel() });

  function resetFilters() { setDatePreset("month"); setCustomStart(monthStart); setCustomEnd(today); setSpecialty("all"); setConsultant("all"); setPriority("all"); setDelayReason("all"); setStageAffected("all"); setDelayLength("all"); }
  function exportCsv() { const csvRows = [exportHeaders, ...filteredRows.map((row) => rowValues(row).map(csvExportValue))]; const csv = `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`; download(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFilename("csv")); }
  function exportExcel() { const body = filteredRows.map((row) => `<tr>${rowValues(row).map((value) => `<td>${escapeHtml(String(value)).replaceAll("\n", "<br>")}</td>`).join("")}</tr>`).join(""); const html = `<html><head><meta charset="utf-8" /></head><body><table><thead><tr>${exportHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`; download(new Blob([html], { type: "application/vnd.ms-excel" }), exportFilename("xls")); }
  function exportPdf() { const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" }); doc.text(`Theatreflow CEPOD Audit — ${dateRange.start} to ${dateRange.end}`, 14, 14); autoTable(doc, { startY: 20, head: [exportHeaders], body: filteredRows.map(rowValues), styles: { fontSize: 6, cellPadding: 1.5, overflow: "linebreak" }, headStyles: { fillColor: [8, 145, 178] } }); doc.save(exportFilename("pdf")); }

  return <div className="space-y-4">
    <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>Audit filters</CardTitle><p className="mt-1 text-sm text-muted-foreground">All exports use the filtered rows shown below.</p></div><Button type="button" variant="outline" onClick={resetFilters}><FilterX className="h-4 w-4" />Reset filters</Button></div></CardHeader><CardContent className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FilterField label="Date booked"><Select value={datePreset} onChange={(event) => setDatePreset(event.target.value as DatePreset)}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom dates</option></Select></FilterField>
      {datePreset === "custom" ? <><FilterField label="Start date"><DateInput value={customStart} onChange={setCustomStart} /></FilterField><FilterField label="End date"><DateInput value={customEnd} onChange={setCustomEnd} /></FilterField></> : null}
      <FilterField label="Specialty"><Select value={specialty} onChange={(event) => { setSpecialty(event.target.value); setConsultant("all"); }}><option value="all">All specialties</option>{specialties.map((item) => <option key={item}>{item}</option>)}</Select></FilterField>
      <FilterField label="Consultant"><Select value={consultant} onChange={(event) => setConsultant(event.target.value)}><option value="all">All consultants</option>{consultants.map((item) => <option key={item}>{item}</option>)}</Select></FilterField>
      <FilterField label="Priority"><Select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option>{["P1", "P2", "P3", "P4"].map((item) => <option key={item}>{item}</option>)}</Select></FilterField>
      <FilterField label="Delay reason"><Select value={delayReason} onChange={(event) => setDelayReason(event.target.value)}><option value="all">All delay reasons</option>{delayReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</Select></FilterField>
      <FilterField label="Stage affected"><Select value={stageAffected} onChange={(event) => setStageAffected(event.target.value)}><option value="all">All affected stages</option>{Object.entries(workflowStageLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></FilterField>
      <FilterField label="Delay length"><Select value={delayLength} onChange={(event) => setDelayLength(event.target.value as DelayLength)}><option value="all">All delay lengths</option><option value="under30">Under 30 minutes</option><option value="30-60">30–60 minutes</option><option value="60-90">60–90 minutes</option><option value="90-120">90–120 minutes</option><option value="120-180">120–180 minutes</option><option value="over180">Over 180 minutes</option></Select></FilterField>
    </CardContent></Card>

    <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>Audit export</CardTitle><p className="mt-1 text-sm text-muted-foreground">{filteredRows.length} patient{filteredRows.length === 1 ? "" : "s"} match the selected filters.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!filteredRows.length} onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button><Button type="button" variant="outline" disabled={!filteredRows.length} onClick={exportExcel}><Download className="h-4 w-4" />Excel</Button><Button type="button" disabled={!filteredRows.length} onClick={exportPdf}><Download className="h-4 w-4" />PDF</Button></div></div></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[1820px] text-sm"><thead className="bg-muted">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="whitespace-nowrap px-3 py-3 text-left font-semibold">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-t align-top hover:bg-muted/30">{row.getVisibleCells().map((cell) => <td key={cell.id} className="max-w-64 whitespace-pre-line px-3 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{!filteredRows.length ? <div className="p-8 text-center text-sm text-muted-foreground">No audit records match these filters.</div> : null}</div></CardContent></Card>
  </div>;
}

function buildRows(patients: PatientWithStage[], events: WorkflowEvent[], labels: Map<string, string>): ReportRow[] { const byPatient = new Map<string, WorkflowEvent[]>(); events.forEach((event) => byPatient.set(event.patient_id, [...(byPatient.get(event.patient_id) ?? []), event])); return patients.map((patient) => { const patientEvents = (byPatient.get(patient.id) ?? []).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)); const reasons = new Set<string>(); const stages = new Set<string>(); let delayMinutes = 0; patientEvents.forEach((event, index) => { if (!event.delay_reason_ids.length) return; event.delay_reason_ids.forEach((id) => reasons.add(labels.get(id) ?? id)); stages.add(workflowStageLabels[event.workflow_stage_id] ?? event.workflow_stage_id); const previous = patientEvents[index - 1]?.timestamp ?? patient.created_at; delayMinutes += Math.max(0, Math.round((Date.parse(event.timestamp) - Date.parse(previous)) / 60_000)); }); return { hospitalNumber: patient.hospital_number, procedure: patient.procedure, specialty: patient.specialty, consultant: patient.consultant, priority: patient.cepod_priority, status: patient.cancelled ? "Cancelled" : patient.current_stage === "patient-out-of-recovery" ? "Completed" : patient.booking_cohort === "moved_to_planned" ? "Planned" : "Active", dateBooked: formatRecordDate(patient.created_at), dateBookedKey: localDateKey(new Date(patient.created_at)), recordDate: formatRecordDate(patient.cancelled_at ?? patient.completed_at), cancellationReason: patient.cancellation_reason ?? "—", delay: reasons.size ? "Yes" : "No", delayReason: reasons.size ? [...reasons].join("\n") : "—", stagesAffected: stages.size ? [...stages].join("\n") : "—", delayMinutes }; }); }
function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold">{label}<div className="mt-1">{children}</div></label>; }
function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input type="date" className="pl-9" value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function getDateRange(preset: DatePreset, start: string, end: string) { const now = new Date(); if (preset === "custom") { const safeStart = start || localDateKey(now); const safeEnd = end || safeStart; return { start: safeStart <= safeEnd ? safeStart : safeEnd, end: safeStart <= safeEnd ? safeEnd : safeStart }; } if (preset === "today") return { start: localDateKey(now), end: localDateKey(now) }; const from = new Date(now); if (preset === "7d") from.setDate(now.getDate() - 6); if (preset === "month") from.setDate(1); if (preset === "year") { from.setMonth(0); from.setDate(1); } return { start: localDateKey(from), end: localDateKey(now) }; }
function matchesDelayLength(minutes: number, filter: DelayLength) { if (filter === "all") return true; if (filter === "under30") return minutes > 0 && minutes < 30; if (filter === "30-60") return minutes >= 30 && minutes < 60; if (filter === "60-90") return minutes >= 60 && minutes < 90; if (filter === "90-120") return minutes >= 90 && minutes < 120; if (filter === "120-180") return minutes >= 120 && minutes <= 180; return minutes > 180; }
function formatRecordDate(value?: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function localDateKey(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function csvCell(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function csvExportValue(value: string | number) { const text = String(value); if (text === "—") return ""; return text.replaceAll("\n", "; "); }
function exportFilename(extension: string) { return `theatreflow-audit-${localDateKey(new Date())}.${extension}`; }
function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
