import type { DelayReason, InfrastructureEvent, MetricCard, PatientWithStage, WorkflowEvent } from "@/lib/types/domain";

export function buildExecutiveMetrics(patients: PatientWithStage[], events: WorkflowEvent[]): MetricCard[] {
  const completed = patients.filter((patient) => patient.current_stage === "patient-out-of-recovery").length;
  const cancelled = patients.filter((patient) => patient.cancelled).length;
  const delayed = patients.filter((patient) => patient.delay_status !== "green").length;
  const avgTurnaround = patients.length
    ? Math.round(patients.reduce((total, patient) => total + patient.elapsed_minutes, 0) / patients.length)
    : 0;

  return [
    { label: "Total cases", value: String(patients.length), change: "+8% vs last 7 days", tone: "neutral" },
    { label: "Average turnaround", value: `${avgTurnaround}m`, change: "Measured from current stage", tone: "neutral" },
    { label: "Cases completed", value: String(completed), change: "Patient out of recovery", tone: "good" },
    { label: "Cases cancelled", value: String(cancelled), change: "Audit retained", tone: cancelled ? "warning" : "good" },
    { label: "Cases delayed", value: String(delayed), change: `${events.filter((event) => event.delay_reason_ids.length).length} delay events`, tone: delayed ? "warning" : "good" },
    { label: "Average theatre turnaround", value: "31m", change: "Procedure finish to next knife", tone: "neutral" },
    { label: "Average anaesthetic time", value: "42m", change: "Anaesthetic start to knife", tone: "neutral" },
    { label: "Average recovery time", value: "67m", change: "Out of theatre to ward", tone: "warning" }
  ];
}

export function delayReasonSeries(events: WorkflowEvent[], reasons: DelayReason[]) {
  return reasons
    .map((reason) => ({
      name: reason.label,
      value: events.filter((event) => event.delay_reason_ids.includes(reason.id)).length
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function stageOccupancySeries(patients: PatientWithStage[]) {
  const bands = ["Waiting", "Sent For", "Arrived", "Anaesthetic", "Operating", "Recovery", "Ward"];
  return bands.map((band) => ({
    name: band,
    cases: patients.filter((patient) => patient.stage.board_band === band).length
  }));
}

export function infrastructureSeries(events: InfrastructureEvent[]) {
  return events.map((event) => {
    const end = event.end_time ? Date.parse(event.end_time) : Date.now();
    const minutes = Math.max(0, Math.round((end - Date.parse(event.start_time)) / 60_000));
    return {
      name: event.type,
      minutes,
      affected: event.active ? 2 : 1
    };
  });
}

export const trendSeries = [
  { name: "Mon", delays: 8, cases: 18 },
  { name: "Tue", delays: 6, cases: 16 },
  { name: "Wed", delays: 11, cases: 21 },
  { name: "Thu", delays: 5, cases: 15 },
  { name: "Fri", delays: 9, cases: 20 },
  { name: "Sat", delays: 4, cases: 11 },
  { name: "Sun", delays: 7, cases: 14 }
];

export const heatmapHours = Array.from({ length: 12 }, (_, index) => ({
  hour: `${8 + index}:00`,
  delays: [2, 3, 5, 4, 6, 3, 7, 8, 5, 4, 3, 2][index]
}));
