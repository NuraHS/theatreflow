"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, CalendarDays, Clock3, Info, RefreshCw, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRealtimeWorkflow } from "@/hooks/use-realtime-workflow";
import { SUPPORTED_SPECIALTIES } from "@/lib/constants/clinical-teams";
import type { DelayReason, PatientListMovement, PatientWithStage, TheatreConfiguration, WorkflowEvent } from "@/lib/types/domain";

const colours = ["#0891b2", "#7c3aed", "#ca8a04", "#0f766e", "#dc2626", "#4f46e5", "#be185d", "#65a30d"];
const chartTooltipStyle: React.CSSProperties = { backgroundColor: "#ffffff", borderColor: "#d1d5db", color: "#111827" };
const chartTooltipLabelStyle: React.CSSProperties = { color: "#111827", fontWeight: 600 };
const responsiveChartStyle: React.CSSProperties = { width: "100%", height: "100%", maxWidth: "100%" };
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

type Props = {
  patients: PatientWithStage[];
  events: WorkflowEvent[];
  delayReasons: DelayReason[];
  theatreConfiguration: TheatreConfiguration;
  patientListMovements: PatientListMovement[];
  initialNow: string;
};

export function DashboardCharts({ patients, events, delayReasons, theatreConfiguration, patientListMovements, initialNow }: Props) {
  const router = useRouter();
  const refreshDashboard = React.useCallback(() => router.refresh(), [router]);
  useRealtimeWorkflow(refreshDashboard);
  const today = localDateKey(new Date());
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);
  const [specialty, setSpecialty] = React.useState("all");
  const [location, setLocation] = React.useState("all");
  const [delayStage, setDelayStage] = React.useState("all");
  const [delayReason, setDelayReason] = React.useState("all");
  const [now, setNow] = React.useState(() => new Date(initialNow));

  React.useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 3_600_000); return () => window.clearInterval(timer); }, []);
  React.useEffect(() => { const timer = window.setInterval(refreshDashboard, 15_000); return () => window.clearInterval(timer); }, [refreshDashboard]);

  const range = normaliseRange(startDate, endDate);
  const locationPatients = patients.filter((patient) => patientMatchesLocation(patient, location, theatreConfiguration));
  const specialtyPatients = locationPatients.filter((patient) => specialty === "all" || patient.specialty === specialty);
  const dashboardPatients = specialtyPatients.filter((patient) => patientWasActiveDuringRange(patient, range));
  const patientIds = new Set(dashboardPatients.map((patient) => patient.id));
  const rangeEvents = events.filter((event) => patientIds.has(event.patient_id) && inDateRange(event.timestamp, range));
  const currentListPatients = dashboardPatients.filter((patient) => patientIsActiveAtEnd(patient, range));
  const currentListStates = new Map(currentListPatients.map((patient) => [patient.id, getListStateAt(patient, patientListMovements, range.end)]));
  const currentStages = new Map(currentListPatients.map((patient) => [patient.id, getStageAt(patient, events, range.end)]));
  const plannedPatients = currentListPatients.filter((patient) => currentListStates.get(patient.id) === "planned");
  const cepodPatients = currentListPatients.filter((patient) => currentListStates.get(patient.id) === "cepod");
  const unresolvedPatients = cepodPatients.filter((patient) => patient.unresolved);
  const liveCepodPatients = cepodPatients.filter((patient) => !patient.unresolved);
  const completedPatients = dashboardPatients.filter((patient) => patient.completed_at ? inDateRange(patient.completed_at, range) : rangeEvents.some((event) => event.patient_id === patient.id && event.workflow_stage_id === "patient-out-of-recovery"));
  const cancelledPatients = dashboardPatients.filter((patient) => patient.cancelled_at ? inDateRange(patient.cancelled_at, range) : patient.cancelled && inDateRange(patient.operation_date ?? patient.created_at, range));
  const waitingPatients = liveCepodPatients.filter((patient) => currentStages.get(patient.id) === "patient-on-list");
  const anaestheticPatients = liveCepodPatients.filter((patient) => ["patient-arrived", "anaesthetic-started"].includes(currentStages.get(patient.id) ?? ""));
  const theatrePatients = liveCepodPatients.filter((patient) => ["patient-in-theatre", "operation-started", "operation-finished"].includes(currentStages.get(patient.id) ?? ""));
  const recoveryPatients = liveCepodPatients.filter((patient) => currentStages.get(patient.id) === "patient-in-recovery");
  const delayedPatientIds = new Set(rangeEvents.filter((event) => event.delay_reason_ids.length).map((event) => event.patient_id));
  const delayedPatients = dashboardPatients.filter((patient) => delayedPatientIds.has(patient.id));
  const awaitingSurgeryPatients = liveCepodPatients.filter((patient) => ["patient-on-list", "sent-for", "patient-arrived", "anaesthetic-started", "patient-in-theatre", "operation-started"].includes(currentStages.get(patient.id) ?? ""));
  const completedSurgeryPatients = liveCepodPatients.filter((patient) => ["operation-finished", "patient-in-recovery"].includes(currentStages.get(patient.id) ?? ""));
  const outcomes = buildPriorityOutcomes([
    ["Total booked", dashboardPatients],
    ["Awaiting surgery", awaitingSurgeryPatients],
    ["Completed surgery", completedSurgeryPatients],
    ["Planned patients", plannedPatients],
    ["Cancelled", cancelledPatients],
    ["Unresolved", unresolvedPatients],
    ["Delayed", delayedPatients],
    ["Completed", completedPatients]
  ]);
  const specialties = [...new Set([...SUPPORTED_SPECIALTIES, ...patients.map((patient) => patient.specialty)])];
  const locationLabel = getLocationLabel(location, theatreConfiguration);
  const rangeLabel = formatRange(range);
  const caseSeriesMode = range.startKey === range.endKey && location === "all"
    ? "theatre"
    : range.startKey === range.endKey && location.startsWith("theatre:")
      ? "specialty"
      : "date";
  const caseSeries = caseSeriesMode === "theatre"
    ? buildTheatreCaseSeries(dashboardPatients, theatreConfiguration)
    : caseSeriesMode === "specialty"
      ? buildSpecialtyCaseSeries(dashboardPatients, specialties)
      : buildCaseSeries(dashboardPatients, range);
  const caseChartTitle = caseSeriesMode === "theatre" ? "Cases by theatre" : caseSeriesMode === "specialty" ? "Cases by specialty" : "Cases by date";
  const caseChartSubtitle = caseSeriesMode === "theatre"
    ? `Listed cases by theatre · ${rangeLabel}`
    : caseSeriesMode === "specialty"
      ? `${locationLabel} · ${rangeLabel}`
      : `Listed cases · ${rangeLabel}`;
  const delayReasonEvents = delayStage === "all" ? rangeEvents.filter((event) => event.delay_reason_ids.length) : rangeEvents.filter((event) => event.workflow_stage_id === delayStage && event.delay_reason_ids.length);
  const delayReasonPatientsAffected = new Set(delayReasonEvents.map((event) => event.patient_id)).size;
  const delays = buildDelayData(rangeEvents, delayReasons, delayStage);
  const delayTrend = buildDelayTrend(rangeEvents, delayReason, range, delayReasons, specialtyPatients);
  const timings = buildTimings(dashboardPatients, rangeEvents);
  const firstCaseStart = buildFirstCaseStart(rangeEvents);
  const completionRate = percentage(completedPatients.length, dashboardPatients.length);
  const cancellationRate = percentage(cancelledPatients.length, dashboardPatients.length);
  const delayedRate = percentage(delayedPatients.length, dashboardPatients.length);
  const cancellationReasons = buildCancellationReasons(cancelledPatients);

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
    <section className="clinical-card rounded-lg border bg-card p-4">
      <div>
        <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg font-bold">Executive summary</h2><Badge tone="green">Live</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">Every card reflects the selected dates, specialty and theatre location. Updated {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</p>
      </div>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[170px_170px_minmax(220px,1fr)_minmax(220px,1fr)]">
        <DateField label="Start date" value={startDate} max={endDate} onChange={setStartDate} />
        <DateField label="End date" value={endDate} min={startDate} onChange={setEndDate} />
        <label className="block text-sm font-semibold">Specialty<Select className="mt-1" value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="all">All specialties</option>{specialties.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
        <label className="block text-sm font-semibold">Suite / theatre<Select className="mt-1" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All accessible suites</option>{theatreConfiguration.suites.map((suite) => <optgroup key={suite.id} label={suite.name}><option value={`suite:${suite.id}`}>All {suite.name} theatres</option>{theatreConfiguration.theatres.filter((theatre) => theatre.suite_id === suite.id).map((theatre) => <option key={theatre.id} value={`theatre:${theatre.id}`}>{suite.name} — {theatre.name}</option>)}</optgroup>)}</Select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><PresetButton onClick={() => setPreset("today")}>Today</PresetButton><PresetButton onClick={() => setPreset("week")}>This week</PresetButton><PresetButton onClick={() => setPreset("last-week")}>Last week</PresetButton><PresetButton onClick={() => setPreset("month")}>This month</PresetButton><Button type="button" variant="outline" className="min-h-10 px-3" onClick={() => { setDates(today, today); setSpecialty("all"); setLocation("all"); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />Reset</Button></div>
    </section>

    {unresolvedPatients.length ? (
      <section className="rounded-lg border border-red-400 bg-red-50 p-4 text-red-950 dark:border-red-800 dark:bg-red-950/35 dark:text-red-50" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-bold">{unresolvedPatients.length} unresolved case{unresolvedPatients.length === 1 ? "" : "s"} require review</h2>
              <p className="mt-1 text-sm">These cases are excluded from live stage counts until a staff member confirms the correct stage.</p>
            </div>
          </div>
          <Link href="/patients#unresolved-cases" className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:ring-4 focus-visible:ring-red-300">Review cases</Link>
        </div>
      </section>
    ) : null}

    <Card className="border-primary/20 bg-gradient-to-br from-card to-secondary/30"><CardHeader><CardTitle>Case summary</CardTitle><p className="text-sm text-muted-foreground">{rangeLabel}{specialty === "all" ? " · All specialties" : ` · ${specialty}`} · {locationLabel}</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"><Summary label="Total cases" value={dashboardPatients.length} detail="All patients who were on either the CEPOD list or planned list during the selected period, including patients completed or cancelled during that period." featured /><Summary label="Currently waiting" value={waitingPatients.length} detail="Patients on the CEPOD list at the end of the selected period who are still waiting to be sent for. Planned, completed and cancelled patients are not included." /><Summary label="In anaesthetic" value={anaestheticPatients.length} detail="Patients on the CEPOD list who have arrived in the anaesthetic room or whose anaesthetic has started." /><Summary label="In theatre" value={theatrePatients.length} detail="Patients on the CEPOD list who are in theatre, whose operation has started, or whose operation has finished but who have not yet entered recovery." /><Summary label="In recovery" value={recoveryPatients.length} detail="Patients on the CEPOD list who are currently in recovery and have not yet left recovery." /><Summary label="Completed cases" value={completedPatients.length} detail="Patients who completed surgery and left recovery during the selected period." /><Summary label="Cancelled" value={cancelledPatients.length} detail="Patients whose case was cancelled during the selected period." /><Summary label="Delayed cases" value={delayedPatients.length} detail="Patients who experienced at least one recorded delay during the selected period." /><Summary label="Patients on planned list" value={plannedPatients.length} detail="Patients whose most recent list entry at the end of the selected period places them on the planned list. They remain counted each day until they move to CEPOD, complete or are cancelled." /><Summary label="Cases experiencing delay" value={`${delayedRate}%`} detail="Delayed cases as a percentage of the total cases in the selected period." /><Summary label="Completion rate" value={`${completionRate}%`} detail="Completed cases as a percentage of the total cases in the selected period." /><Summary label="Cancellation rate" value={`${cancellationRate}%`} detail="Cancelled cases as a percentage of the total cases in the selected period." /><Summary label="Unresolved" value={unresolvedPatients.length} detail={'Patients whose pathway has not been updated within the reconciliation period. Please go to "Unresolved Patients" on the patients page to confirm their current stage.'} /></CardContent></Card>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ChartCard title={caseChartTitle} subtitle={caseChartSubtitle}><div className="h-[340px] min-w-0 w-full"><BarChart responsive style={responsiveChartStyle} data={caseSeries} margin={{ top: 8, right: 8, left: -12, bottom: caseSeriesMode === "specialty" ? 54 : 18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" interval={0} height={caseSeriesMode === "specialty" ? 62 : 30} tick={caseSeriesMode === "specialty" ? <SpecialtyAxisTick /> : undefined} /><YAxis allowDecimals={false} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />{caseSeriesMode === "specialty" ? <Bar dataKey="Cases" fill="#0891b2" radius={[4, 4, 0, 0]} isAnimationActive={false} /> : <><Legend content={<SpecialtyLegend />} />{specialties.map((item, index) => <Bar key={item} dataKey={item} stackId="cases" fill={specialtyColour(item, index)} isAnimationActive={false} />)}</>}</BarChart></div></ChartCard>
      <ChartCard title="Case outcomes" subtitle={`Priority mix · ${rangeLabel}`}><div className="h-[350px] min-w-0 w-full"><BarChart responsive style={responsiveChartStyle} data={outcomes} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={<OutcomeTick />} interval={0} height={54} /><YAxis allowDecimals={false} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} /><Legend /><Bar dataKey="P1" stackId="priority" fill="#dc2626" isAnimationActive={false} /><Bar dataKey="P2" stackId="priority" fill="#f59e0b" isAnimationActive={false} /><Bar dataKey="P3" stackId="priority" fill="#16a34a" isAnimationActive={false} /><Bar dataKey="P4" stackId="priority" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></div></ChartCard>
    </div>

    <Card><CardHeader><CardTitle>Average stage progression time</CardTitle><p className="text-sm text-muted-foreground">Complete timestamp pairs · {rangeLabel}</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{[...timings, firstCaseStart].map((item) => <div key={item.label} className="relative rounded-lg border bg-muted/30 p-4"><Clock3 className="h-4 w-4 text-primary" aria-hidden="true" /><InfoTooltip text={timingHelp[item.label]} /><p className="mt-3 text-sm font-semibold text-muted-foreground">{item.label === "First case start" ? "First case start time" : `Average ${item.label.toLowerCase()} time`}</p><p className="mt-1 text-2xl font-bold">{item.display}</p>{item.secondary ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{item.secondary}</p> : null}</div>)}</div></CardContent></Card>

    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartCard title="Delay reasons" subtitle={`${rangeLabel} · ${delayReasonPatientsAffected} patient${delayReasonPatientsAffected === 1 ? "" : "s"} affected during selected period`} action={<Select className="w-full sm:w-56" value={delayStage} onChange={(event) => setDelayStage(event.target.value)} aria-label="Workflow stage affected"><option value="all">All workflow stages</option>{delayStages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>}>{delays.length ? <ol className="space-y-2">{delays.map((item, index) => <li key={item.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">{index + 1}</span><span className="font-semibold">{item.name}</span><Badge tone="amber">{item.value}</Badge></li>)}</ol> : <EmptyState text="No delays recorded for these filters" />}</ChartCard>
      <ChartCard title="Delay trends (number of patients affected)" subtitle={`Trend within ${rangeLabel}`} action={<Select className="w-full sm:w-56" value={delayReason} onChange={(event) => setDelayReason(event.target.value)} aria-label="Delay reason"><option value="all">All delay reasons</option>{delayReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</Select>}>{delayTrend.length ? <div className="h-[300px] min-w-0 w-full"><LineChart responsive style={responsiveChartStyle} data={delayTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip content={<DelayTrendTooltip />} wrapperStyle={{ pointerEvents: "auto", zIndex: 30 }} /><Line type="monotone" dataKey="patientsDelayed" name="Patients delayed" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} /></LineChart></div> : <EmptyState text="No trend data for these filters" />}</ChartCard>
    </div>
    <ChartCard title="Cancellation reasons" subtitle={`Cancelled cases ranked by frequency · ${rangeLabel}`}>{cancellationReasons.length ? <ol className="grid gap-2 md:grid-cols-2">{cancellationReasons.map((item, index) => <li key={item.reason} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">{index + 1}</span><span className="font-semibold">{item.reason}</span><Badge tone="red">{item.count}</Badge></li>)}</ol> : <EmptyState text="No cancellations recorded for these filters" />}</ChartCard>
  </div>;
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold">{label}<div className="relative mt-1"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input type="date" className="pl-9" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} /></div></label>; }
function PresetButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="min-h-10 cursor-pointer rounded-md border bg-background px-3 text-sm font-semibold hover:bg-muted">{children}</button>; }
function patientMatchesLocation(patient: PatientWithStage, location: string, configuration: TheatreConfiguration) {
  if (location === "all") return true;
  const [scope, id] = location.split(":", 2);
  if (scope === "theatre") return patient.theatre_id === id;
  if (scope === "suite") {
    const theatreIds = new Set(configuration.theatres.filter((theatre) => theatre.suite_id === id).map((theatre) => theatre.id));
    return Boolean(patient.theatre_id && theatreIds.has(patient.theatre_id));
  }
  return true;
}
function getLocationLabel(location: string, configuration: TheatreConfiguration) {
  if (location === "all") return "All accessible suites";
  const [scope, id] = location.split(":", 2);
  if (scope === "suite") return configuration.suites.find((suite) => suite.id === id)?.name ?? "Selected suite";
  const theatre = configuration.theatres.find((item) => item.id === id);
  const suite = theatre ? configuration.suites.find((item) => item.id === theatre.suite_id) : null;
  return theatre ? `${suite?.name ?? "Suite"} · ${theatre.name}` : "Selected theatre";
}
function Summary({ label, value, detail, featured = false }: { label: string; value: string | number; detail: string; featured?: boolean }) { return <div className={`clinical-card relative min-h-32 rounded-lg border bg-card p-4 pr-14 ${featured ? "border-primary/40 ring-2 ring-primary/10" : ""}`}><InfoTooltip text={detail} /><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function ChartCard({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) { return <Card className="min-w-0 overflow-hidden"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><CardTitle>{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{action}</div></CardHeader><CardContent className="min-w-0">{children}</CardContent></Card>; }
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
    "Planned patients": ["Planned", "patients"],
    Cancelled: ["Cancelled"],
    Unresolved: ["Unresolved"],
    Delayed: ["Delayed"],
    Completed: ["Completed"]
  };
  const lines = labels[payload?.value ?? ""] ?? [payload?.value ?? ""];
  return <g transform={`translate(${x},${y})`}><text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">{lines.map((line, index) => <tspan key={line} x="0" dy={index === 0 ? 16 : 14}>{line}</tspan>)}</text></g>;
}
function SpecialtyAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const value = payload?.value ?? "";
  const labels: Record<string, string[]> = {
    "General Surgery": ["General", "Surgery"],
    "Trauma and orthopaedics": ["Trauma &", "orthopaedics"],
    "Obstetrics and gynaecology": ["Obstetrics &", "gynaecology"]
  };
  const lines = labels[value] ?? [value];
  return <g transform={`translate(${x},${y})`}><text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">{lines.map((line, index) => <tspan key={line} x="0" dy={index === 0 ? 16 : 14}>{line}</tspan>)}</text></g>;
}
type Range = { start: Date; end: Date; startKey: string; endKey: string };
function normaliseRange(start: string, end: string): Range { const startKey = start <= end ? start : end; const endKey = start <= end ? end : start; return { start: new Date(`${startKey}T00:00:00`), end: new Date(`${endKey}T23:59:59.999`), startKey, endKey }; }
function inDateRange(value: string, range: Range) { const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return date >= range.start && date <= range.end; }
function patientWasActiveDuringRange(patient: PatientWithStage, range: Range) {
  if (Date.parse(patient.created_at) > range.end.getTime()) return false;
  const closedAt = earliestDate(patient.cancelled_at, patient.completed_at);
  return !closedAt || closedAt.getTime() >= range.start.getTime();
}
function patientIsActiveAtEnd(patient: PatientWithStage, range: Range) {
  if (Date.parse(patient.created_at) > range.end.getTime()) return false;
  const closedAt = earliestDate(patient.cancelled_at, patient.completed_at);
  return !closedAt || closedAt.getTime() > range.end.getTime();
}
function earliestDate(...values: Array<string | null | undefined>) {
  const dates = values.filter((value): value is string => Boolean(value)).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}
function getListStateAt(patient: PatientWithStage, movements: PatientListMovement[], at: Date): "cepod" | "planned" {
  const latest = movements
    .filter((movement) => movement.patient_id === patient.id && movement.movement_type !== "rescheduled" && Date.parse(movement.moved_at) <= at.getTime())
    .sort((a, b) => Date.parse(b.moved_at) - Date.parse(a.moved_at))[0];
  if (latest) return latest.movement_type === "to_planned" ? "planned" : "cepod";
  return dateKey(patient.operation_date ?? patient.created_at) > dateKey(patient.created_at) ? "planned" : "cepod";
}
function getStageAt(patient: PatientWithStage, events: WorkflowEvent[], at: Date) {
  return events
    .filter((event) => event.patient_id === patient.id && Date.parse(event.timestamp) <= at.getTime())
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]?.workflow_stage_id ?? "patient-on-list";
}
function buildCaseSeries(patients: PatientWithStage[], range: Range) { const days = Math.floor((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1; const weekly = days > 31; const buckets = new Map<string, Record<string, string | number>>(); const cursor = weekly ? startOfWeek(range.start) : new Date(range.start); const final = weekly ? startOfWeek(range.end) : new Date(range.end); while (cursor <= final) { const key = localDateKey(cursor); buckets.set(key, { label: weekly ? `w/c ${cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }); cursor.setDate(cursor.getDate() + (weekly ? 7 : 1)); } patients.forEach((patient) => { const date = new Date(`${dateKey(patient.operation_date ?? patient.created_at)}T12:00:00`); const anchor = weekly ? startOfWeek(date) : date; const key = localDateKey(anchor); const bucket = buckets.get(key); if (!bucket) return; bucket[patient.specialty] = Number(bucket[patient.specialty] ?? 0) + 1; }); return [...buckets.values()]; }
function buildTheatreCaseSeries(patients: PatientWithStage[], configuration: TheatreConfiguration) {
  const suites = new Map(configuration.suites.map((suite) => [suite.id, suite]));
  const suiteOrder = new Map(configuration.suites.map((suite) => [suite.id, suite.display_order]));
  const theatres = [...configuration.theatres].sort((a, b) =>
    (suiteOrder.get(a.suite_id) ?? 0) - (suiteOrder.get(b.suite_id) ?? 0) || a.display_order - b.display_order
  );
  return theatres.map((theatre) => {
    const suite = suites.get(theatre.suite_id);
    const row: Record<string, string | number> = {
      label: `${suiteInitials(suite?.name ?? "Suite")}${theatreNumber(theatre.name, theatre.display_order)}`
    };
    patients.filter((patient) => patient.theatre_id === theatre.id).forEach((patient) => {
      row[patient.specialty] = Number(row[patient.specialty] ?? 0) + 1;
    });
    return row;
  });
}
function buildSpecialtyCaseSeries(patients: PatientWithStage[], specialties: string[]) {
  return specialties.map((item) => ({ label: item, Cases: patients.filter((patient) => patient.specialty === item).length }));
}
function suiteInitials(name: string) {
  return (name.match(/\b[A-Za-z]/g) ?? [name[0] ?? "S"]).join("").toUpperCase();
}
function theatreNumber(name: string, fallback: number) {
  return name.match(/\d+/)?.[0] ?? String(fallback);
}
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
  return <div className="max-h-64 w-[min(18rem,calc(100vw-3rem))] overflow-y-auto overscroll-contain rounded-md border bg-background p-2.5 text-xs text-foreground shadow-xl"><div className="sticky -top-2.5 z-10 -mx-2.5 -mt-2.5 border-b bg-background px-2.5 py-2"><p className="font-bold">{item?.tooltipDate}</p><p className="mt-0.5 font-semibold">Patients affected: {item?.patientsDelayed ?? 0}</p></div><div className="mt-2 space-y-2">{item?.patients?.map((patient) => <div key={patient.label} className="rounded border bg-muted/20 p-2"><p className="font-bold leading-snug" style={{ color: specialtyColour(patient.specialty, 0) }}>{patient.label} · {patient.priority}</p><p className="mt-0.5 leading-snug text-muted-foreground">{patient.specialty}</p><ul className="mt-1 list-disc space-y-0.5 pl-4 leading-snug text-foreground">{patient.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>)}</div></div>;
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
