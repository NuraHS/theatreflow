"use client";

import * as React from "react";
import { Activity, CalendarDays, Clock3, Info, RefreshCw, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SUPPORTED_SPECIALTIES } from "@/lib/constants/clinical-teams";
import type { DelayReason, PatientWithStage, WorkflowEvent } from "@/lib/types/domain";

const colours = ["#0891b2", "#7c3aed", "#ca8a04", "#0f766e", "#dc2626", "#4f46e5", "#be185d", "#65a30d"];
const timingHelp: Record<string, string> = {
  Sending: 'Time between “Patient sent for” and “Patient arrived in Theatres”.',
  Anaesthetic: 'Time between “Anaesthetic started” and “Patient in Theatre”.',
  Operating: 'Time between “Operation started” and “Operation finished”.',
  Recovery: 'Time between “Patient in Recovery” and “Patient out of Recovery”.',
  "Theatre turnaround": 'Time from the previous patient’s operation finishing to the next patient’s operation starting. Both average and median are shown.',
  "First case start": 'The first recorded “Operation started” time on each selected day. Both average and median clock times are shown.'
};
const delayStages = [
  ["sent-for", "Patient sent for"], ["patient-arrived", "Patient arrived in Theatres"], ["anaesthetic-started", "Anaesthetic started"],
  ["patient-in-theatre", "Patient in Theatre"], ["operation-started", "Operation started"], ["operation-finished", "Operation finished"],
  ["patient-in-recovery", "Patient in Recovery"], ["patient-out-of-recovery", "Patient out of Recovery"]
] as const;

type Props = { patients: PatientWithStage[]; events: WorkflowEvent[]; delayReasons: DelayReason[] };

export function DashboardCharts({ patients, events, delayReasons }: Props) {
  const today = localDateKey(new Date());
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);
  const [specialty, setSpecialty] = React.useState("all");
  const [delayStage, setDelayStage] = React.useState("all");
  const [delayReason, setDelayReason] = React.useState("all");
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 3_600_000); return () => window.clearInterval(timer); }, []);

  const range = normaliseRange(startDate, endDate);
  const specialtyPatients = patients.filter((patient) => specialty === "all" || patient.specialty === specialty);
  const patientIds = new Set(specialtyPatients.map((patient) => patient.id));
  const scheduledPatients = specialtyPatients.filter((patient) => inDateRange(patient.operation_date ?? patient.created_at, range));
  const rangeEvents = events.filter((event) => patientIds.has(event.patient_id) && inDateRange(event.timestamp, range));
  const bookedPatients = scheduledPatients.filter((patient) => patient.booking_cohort !== "moved_to_planned");
  const movedPatients = scheduledPatients.filter((patient) => patient.booking_cohort === "moved_to_planned");
  const completedPatients = scheduledPatients.filter((patient) => patient.current_stage === "patient-out-of-recovery");
  const cancelledPatients = scheduledPatients.filter((patient) => patient.cancelled);
  const waitingPatients = scheduledPatients.filter((patient) => !patient.cancelled && ["Waiting", "Sent For", "Arrived"].includes(patient.stage.board_band));
  const delayedPatientIds = new Set(rangeEvents.filter((event) => event.delay_reason_ids.length).map((event) => event.patient_id));
  const delayedPatients = scheduledPatients.filter((patient) => delayedPatientIds.has(patient.id));
  const awaitingSurgeryPatients = scheduledPatients.filter((patient) => !patient.cancelled && ["sent-for", "patient-arrived", "anaesthetic-started", "patient-in-theatre", "operation-started"].includes(patient.current_stage));
  const completedSurgeryPatients = scheduledPatients.filter((patient) => !patient.cancelled && ["operation-finished", "patient-in-recovery"].includes(patient.current_stage));
  const outcomes = buildPriorityOutcomes([
    ["Total booked", scheduledPatients],
    ["Awaiting surgery", awaitingSurgeryPatients],
    ["Completed surgery", completedSurgeryPatients],
    ["Moved to planned", movedPatients],
    ["Cancelled", cancelledPatients],
    ["Delayed", delayedPatients],
    ["Completed", completedPatients]
  ]);
  const specialties = [...new Set([...SUPPORTED_SPECIALTIES, ...patients.map((patient) => patient.specialty)])];
  const caseSeries = buildCaseSeries(scheduledPatients, range);
  const delays = buildDelayData(rangeEvents, delayReasons, delayStage);
  const delayTrend = buildDelayTrend(rangeEvents, delayReason, range, delayReasons, specialtyPatients);
  const timings = buildTimings(specialtyPatients, rangeEvents);
  const firstCaseStart = buildFirstCaseStart(rangeEvents);
  const completionRate = percentage(completedPatients.length, scheduledPatients.length);
  const cancellationRate = percentage(cancelledPatients.length, scheduledPatients.length);
  const delayedRate = percentage(delayedPatients.length, scheduledPatients.length);
  const cancellationReasons = buildCancellationReasons(cancelledPatients);
  const rangeLabel = formatRange(range);

  function setPreset(preset: "today" | "week" | "last-week" | "month") {
    const date = new Date();
    if (preset === "today") return setDates(localDateKey(date), localDateKey(date));
    if (preset === "month") return setDates(localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)), localDateKey(date));
    const monday = startOfWeek(date); if (preset === "last-week") monday.setDate(monday.getDate() - 7);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    setDates(localDateKey(monday), localDateKey(sunday));
  }
  function setDates(start: string, end: string) { setStartDate(start); setEndDate(end); }

  return <div className="space-y-4">
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-bold">Executive summary</h2><Badge tone="green">Live</Badge></div><p className="mt-1 text-sm text-muted-foreground">Every card reflects the selected dates and specialty. Updated {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</p></div>
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[170px_170px_240px_140px]">
          <DateField label="Start date" value={startDate} max={endDate} onChange={setStartDate} />
          <DateField label="End date" value={endDate} min={startDate} onChange={setEndDate} />
          <label className="block text-sm font-semibold">Specialty<Select className="mt-1" value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="all">All specialties</option>{specialties.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => { setDates(today, today); setSpecialty("all"); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />Reset</Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><PresetButton onClick={() => setPreset("today")}>Today</PresetButton><PresetButton onClick={() => setPreset("week")}>This week</PresetButton><PresetButton onClick={() => setPreset("last-week")}>Last week</PresetButton><PresetButton onClick={() => setPreset("month")}>This month</PresetButton></div>
    </section>

    <Card className="border-primary/20 bg-gradient-to-br from-card to-secondary/30"><CardHeader><CardTitle>Case summary</CardTitle><p className="text-sm text-muted-foreground">{rangeLabel}{specialty === "all" ? " · All specialties" : ` · ${specialty}`}</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"><Summary label="Total cases" value={scheduledPatients.length} detail="Unique patients scheduled in the selected dates." featured /><Summary label="Currently waiting" value={waitingPatients.length} detail="Patients waiting, sent for or arrived but not yet in theatre." /><Summary label="Booked on CEPOD" value={bookedPatients.length} detail="Patients booked directly on CEPOD who have never been deferred." /><Summary label="Moved to planned" value={movedPatients.length} detail="Planned or deferred patients; returning to CEPOD does not change this cohort." /><Summary label="Completed" value={completedPatients.length} detail="Selected patients recorded as out of recovery." /><Summary label="Cancelled" value={cancelledPatients.length} detail="Selected patients whose operation was cancelled." /><Summary label="Delayed cases" value={delayedPatients.length} detail="Unique selected patients with at least one recorded delay." /><Summary label="Cases experiencing delay" value={`${delayedRate}%`} detail="Delayed unique patients ÷ total selected cases." /><Summary label="Completion rate" value={`${completionRate}%`} detail="Completed unique patients ÷ total selected cases." /><Summary label="Cancellation rate" value={`${cancellationRate}%`} detail="Cancelled unique patients ÷ total selected cases." /></CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <ChartCard title="Cases by date" subtitle={`Booked cases · ${rangeLabel}`}><ResponsiveContainer width="100%" height={340}><BarChart data={caseSeries} margin={{ top: 8, right: 8, left: -12, bottom: 18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Legend content={<SpecialtyLegend />} />{specialties.map((item, index) => <Bar key={item} dataKey={item} stackId="cases" fill={specialtyColour(item, index)} />)}</BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Case outcomes" subtitle={`Priority mix · ${rangeLabel}`}><ResponsiveContainer width="100%" height={350}><BarChart data={outcomes} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={<OutcomeTick />} interval={0} height={54} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="P1" stackId="priority" fill="#dc2626" /><Bar dataKey="P2" stackId="priority" fill="#f59e0b" /><Bar dataKey="P3" stackId="priority" fill="#16a34a" /><Bar dataKey="P4" stackId="priority" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
    </div>

    <Card><CardHeader><CardTitle>Average stage progression time</CardTitle><p className="text-sm text-muted-foreground">Complete timestamp pairs · {rangeLabel}</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{[...timings, firstCaseStart].map((item) => <div key={item.label} className="relative rounded-lg border bg-muted/30 p-4"><Clock3 className="h-4 w-4 text-primary" aria-hidden="true" /><InfoTooltip text={timingHelp[item.label]} /><p className="mt-3 text-sm font-semibold text-muted-foreground">{item.label === "First case start" ? "First case start time" : `Average ${item.label.toLowerCase()} time`}</p><p className="mt-1 text-2xl font-bold">{item.display}</p>{item.secondary ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{item.secondary}</p> : null}</div>)}</div></CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Delay reasons" subtitle={`${rangeLabel} · ${rangeEvents.filter((event) => event.delay_reason_ids.length).length} delay events`} action={<Select className="w-full sm:w-56" value={delayStage} onChange={(event) => setDelayStage(event.target.value)} aria-label="Workflow stage affected"><option value="all">All workflow stages</option>{delayStages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>}>{delays.length ? <ol className="space-y-2">{delays.map((item, index) => <li key={item.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">{index + 1}</span><span className="font-semibold">{item.name}</span><Badge tone="amber">{item.value}</Badge></li>)}</ol> : <EmptyState text="No delays recorded for these filters" />}</ChartCard>
      <ChartCard title="Delay trends (number of patients affected)" subtitle={`Trend within ${rangeLabel}`} action={<Select className="w-full sm:w-56" value={delayReason} onChange={(event) => setDelayReason(event.target.value)} aria-label="Delay reason"><option value="all">All delay reasons</option>{delayReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</Select>}>{delayTrend.length ? <ResponsiveContainer width="100%" height={300}><LineChart data={delayTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip content={<DelayTrendTooltip />} /><Line type="monotone" dataKey="patientsDelayed" name="Patients delayed" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <EmptyState text="No trend data for these filters" />}</ChartCard>
    </div>
    <ChartCard title="Cancellation reasons" subtitle={`Cancelled cases ranked by frequency · ${rangeLabel}`}>{cancellationReasons.length ? <ol className="grid gap-2 md:grid-cols-2">{cancellationReasons.map((item, index) => <li key={item.reason} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">{index + 1}</span><span className="font-semibold">{item.reason}</span><Badge tone="red">{item.count}</Badge></li>)}</ol> : <EmptyState text="No cancellations recorded for these filters" />}</ChartCard>
  </div>;
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<div className="relative mt-1"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input type="date" className="pl-9" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} /></div></label>; }
function PresetButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="min-h-10 cursor-pointer rounded-md border bg-background px-3 text-sm font-semibold hover:bg-muted">{children}</button>; }
function Summary({ label, value, detail, featured = false }: { label: string; value: string | number; detail: string; featured?: boolean }) { return <div className={`relative min-h-32 rounded-lg border bg-card p-4 pr-14 shadow-sm ${featured ? "border-primary/40 ring-2 ring-primary/10" : ""}`}><InfoTooltip text={detail} /><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function ChartCard({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) { return <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{action}</div></CardHeader><CardContent>{children}</CardContent></Card>; }
function InfoTooltip({ text }: { text: string }) { return <div className="group absolute right-3 top-3"><button type="button" aria-label={text} className="flex h-11 w-11 cursor-help items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/30"><Info className="h-4 w-4" /></button><div role="tooltip" className="pointer-events-none absolute right-0 top-10 z-20 hidden w-64 rounded-md bg-foreground p-3 text-xs font-medium leading-relaxed text-background shadow-xl group-hover:block group-focus-within:block">{text}</div></div>; }
function EmptyState({ text }: { text: string }) { return <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4" />{text}</div>; }
function SpecialtyLegend({ payload = [] }: { payload?: Array<{ value?: string; color?: string }> }) {
  return <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 pt-2 text-sm leading-tight">{payload.map((item) => <li key={item.value} className="flex max-w-52 items-start gap-2"><span className="mt-1 h-3 w-3 shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" /><span className="whitespace-normal break-words">{item.value}</span></li>)}</ul>;
}
function OutcomeTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const labels: Record<string, string[]> = {
    "Total booked": ["Total", "booked"],
    "Awaiting surgery": ["Awaiting", "surgery"],
    "Completed surgery": ["Completed", "surgery"],
    "Moved to planned": ["Moved to", "planned"],
    Cancelled: ["Cancelled"],
    Delayed: ["Delayed"],
    Completed: ["Completed"]
  };
  const lines = labels[payload?.value ?? ""] ?? [payload?.value ?? ""];
  return <g transform={`translate(${x},${y})`}><text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">{lines.map((line, index) => <tspan key={line} x="0" dy={index === 0 ? 16 : 14}>{line}</tspan>)}</text></g>;
}
type Range = { start: Date; end: Date; startKey: string; endKey: string };
function normaliseRange(start: string, end: string): Range { const startKey = start <= end ? start : end; const endKey = start <= end ? end : start; return { start: new Date(`${startKey}T00:00:00`), end: new Date(`${endKey}T23:59:59.999`), startKey, endKey }; }
function inDateRange(value: string, range: Range) { const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return date >= range.start && date <= range.end; }
function buildCaseSeries(patients: PatientWithStage[], range: Range) { const days = Math.floor((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1; const weekly = days > 31; const buckets = new Map<string, Record<string, string | number>>(); const cursor = weekly ? startOfWeek(range.start) : new Date(range.start); const final = weekly ? startOfWeek(range.end) : new Date(range.end); while (cursor <= final) { const key = localDateKey(cursor); buckets.set(key, { label: weekly ? `w/c ${cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }); cursor.setDate(cursor.getDate() + (weekly ? 7 : 1)); } patients.forEach((patient) => { const date = new Date(`${dateKey(patient.operation_date ?? patient.created_at)}T12:00:00`); const anchor = weekly ? startOfWeek(date) : date; const key = localDateKey(anchor); const bucket = buckets.get(key); if (!bucket) return; bucket[patient.specialty] = Number(bucket[patient.specialty] ?? 0) + 1; }); return [...buckets.values()]; }
function buildDelayData(events: WorkflowEvent[], reasons: DelayReason[], stage: string) { const relevant = stage === "all" ? events : events.filter((event) => event.workflow_stage_id === stage); return reasons.map((reason) => ({ id: reason.id, name: reason.label, value: relevant.filter((event) => event.delay_reason_ids.includes(reason.id)).length })).filter((item) => item.value).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)); }
function buildDelayTrend(events: WorkflowEvent[], reason: string, range: Range, reasonDefinitions: DelayReason[], patients: PatientWithStage[]) {
  const days = Math.floor((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
  const mode = days > 120 ? "month" : days > 31 ? "week" : "day";
  const relevant = events.filter((event) => reason === "all" ? event.delay_reason_ids.length : event.delay_reason_ids.includes(reason));
  const reasonLabels = new Map(reasonDefinitions.map((item) => [item.id, item.label]));
  const patientDetails = new Map(patients.map((patient) => [patient.id, patient]));
  const buckets = new Map<string, { label: string; tooltipDate: string; patients: Map<string, Set<string>> }>();

  relevant.forEach((event) => {
    const date = new Date(event.timestamp);
    const anchor = mode === "month" ? new Date(date.getFullYear(), date.getMonth(), 1) : mode === "week" ? startOfWeek(date) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = localDateKey(anchor);
    const label = mode === "month" ? anchor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : mode === "week" ? `w/c ${anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const bucket = buckets.get(key) ?? { label, tooltipDate: formatTrendDate(anchor, mode), patients: new Map<string, Set<string>>() };
    const patientReasons = bucket.patients.get(event.patient_id) ?? new Set<string>();
    event.delay_reason_ids.forEach((id) => patientReasons.add(reasonLabels.get(id) ?? id));
    bucket.patients.set(event.patient_id, patientReasons);
    buckets.set(key, bucket);
  });

  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, bucket]) => ({
    label: bucket.label,
    tooltipDate: bucket.tooltipDate,
    patientsDelayed: bucket.patients.size,
    patients: [...bucket.patients.entries()].map(([patientId, reasons], index) => {
      const patient = patientDetails.get(patientId);
      return { label: `Patient ${index + 1}`, priority: patient?.cepod_priority ?? "Priority not recorded", specialty: patient?.specialty ?? "Specialty not recorded", reasons: [...reasons] };
    })
  }));
}
function buildTimings(patients: PatientWithStage[], events: WorkflowEvent[]) { const ids = new Set(patients.map((patient) => patient.id)); const relevant = events.filter((event) => ids.has(event.patient_id)); const pairs: [string, string, string][] = [["Sending", "sent-for", "patient-arrived"], ["Anaesthetic", "anaesthetic-started", "patient-in-theatre"], ["Operating", "operation-started", "operation-finished"], ["Recovery", "patient-in-recovery", "patient-out-of-recovery"]]; const result = pairs.map(([label, start, end]) => { const value = averagePair(relevant, start, end); return { label, display: value === null ? "—" : `${value}m`, secondary: "" }; }); const starts = relevant.filter((event) => event.workflow_stage_id === "operation-started").sort(byTime); const turns = relevant.filter((event) => event.workflow_stage_id === "operation-finished").map((finish) => { const next = starts.find((start) => start.patient_id !== finish.patient_id && Date.parse(start.timestamp) > Date.parse(finish.timestamp)); return next ? Math.round((Date.parse(next.timestamp) - Date.parse(finish.timestamp)) / 60_000) : null; }).filter((value): value is number => value !== null && value >= 0 && value < 600); const avgTurn = average(turns); const medianTurn = median(turns); result.push({ label: "Theatre turnaround", display: avgTurn === null ? "—" : `${avgTurn}m avg`, secondary: medianTurn === null ? "" : `${medianTurn}m median` }); return result; }
function buildFirstCaseStart(events: WorkflowEvent[]) { const firstByDay = new Map<string, number>(); events.filter((event) => event.workflow_stage_id === "operation-started").forEach((event) => { const date = new Date(event.timestamp); const minutes = date.getHours() * 60 + date.getMinutes(); const key = localDateKey(date); const existing = firstByDay.get(key); if (existing === undefined || minutes < existing) firstByDay.set(key, minutes); }); const values = [...firstByDay.values()]; const avg = average(values); const med = median(values); return { label: "First case start", display: avg === null ? "—" : `${formatMinutesAsClock(avg)} avg`, secondary: med === null ? "" : `${formatMinutesAsClock(med)} median` }; }
function buildPriorityOutcomes(cohorts: Array<[string, PatientWithStage[]]>) { return cohorts.map(([name, patients]) => ({ name, P1: patients.filter((patient) => patient.cepod_priority === "P1").length, P2: patients.filter((patient) => patient.cepod_priority === "P2").length, P3: patients.filter((patient) => patient.cepod_priority === "P3").length, P4: patients.filter((patient) => patient.cepod_priority === "P4").length })); }
function buildCancellationReasons(patients: PatientWithStage[]) { const counts = new Map<string, number>(); patients.forEach((patient) => { const reason = patient.cancellation_reason?.trim() || "Reason not recorded"; counts.set(reason, (counts.get(reason) ?? 0) + 1); }); return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)); }
type DelayTooltipPatient = { label: string; priority: string; specialty: string; reasons: string[] };
function DelayTrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { tooltipDate?: string; patientsDelayed?: number; patients?: DelayTooltipPatient[] } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return <div className="max-w-sm rounded-md border bg-background p-3 text-sm text-foreground shadow-xl"><p className="font-bold">{item?.tooltipDate}</p><p className="mt-1 font-bold">Patients affected: {item?.patientsDelayed ?? 0}</p><div className="mt-3 space-y-3">{item?.patients?.map((patient) => <div key={patient.label}><p className="font-bold" style={{ color: specialtyColour(patient.specialty, 0) }}>{patient.label} - {patient.priority} ({patient.specialty})</p><p className="mt-1 text-foreground">{patient.reasons.join(", ")}</p></div>)}</div></div>;
}
function averagePair(events: WorkflowEvent[], startId: string, endId: string) { const grouped = new Map<string, WorkflowEvent[]>(); events.forEach((event) => grouped.set(event.patient_id, [...(grouped.get(event.patient_id) ?? []), event])); const values: number[] = []; grouped.forEach((items) => { const start = items.find((item) => item.workflow_stage_id === startId); const end = items.find((item) => item.workflow_stage_id === endId); if (start && end) values.push(Math.round((Date.parse(end.timestamp) - Date.parse(start.timestamp)) / 60_000)); }); return average(values.filter((value) => value >= 0)); }
function average(values: number[]) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null; }
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2); }
function percentage(value: number, total: number) { return total ? Math.min(100, Math.round((value / total) * 100)) : 0; }
function formatMinutesAsClock(value: number) { const hours = Math.floor(value / 60) % 24; const minutes = value % 60; return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`; }
function byTime(a: WorkflowEvent, b: WorkflowEvent) { return Date.parse(a.timestamp) - Date.parse(b.timestamp); }
function dateKey(value: string) { return value.slice(0, 10); }
function localDateKey(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function startOfWeek(date: Date) { const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0); return monday; }
function formatRange(range: Range) { const format = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); return range.startKey === range.endKey ? format(range.start) : `${format(range.start)} – ${format(range.end)}`; }
function formatTrendDate(date: Date, mode: "day" | "week" | "month") { if (mode === "month") return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }); const day = date.getDate(); const formatted = `${day}${ordinalSuffix(day)} ${date.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`; return mode === "week" ? `Week commencing ${formatted}` : formatted; }
function ordinalSuffix(day: number) { if (day % 100 >= 11 && day % 100 <= 13) return "th"; if (day % 10 === 1) return "st"; if (day % 10 === 2) return "nd"; if (day % 10 === 3) return "rd"; return "th"; }
function specialtyColour(specialty: string, index: number) { const name = specialty.toLowerCase(); if (name.includes("urology")) return "#f97316"; if (name.includes("general")) return "#16a34a"; if (name.includes("gyn")) return "#db2777"; if (name.includes("ortho")) return "#2563eb"; return colours[index % colours.length]; }
