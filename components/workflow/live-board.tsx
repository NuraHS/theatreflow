"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BedDouble, Building2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useRealtimeWorkflow } from "@/hooks/use-realtime-workflow";
import type { PatientWithStage, Theatre, TheatreConfiguration, WorkflowBand } from "@/lib/types/domain";
import { delayClasses } from "@/lib/utils/delay";
import { cn } from "@/lib/utils/cn";
import { priorityLabel, priorityTone } from "@/lib/utils/priority";

const bandRows: WorkflowBand[][] = [
  ["Waiting"],
  ["Sent For", "Arrived"],
  ["Anaesthetic", "Operating"],
  ["Recovery"],
  ["Ward"]
];

export function LiveBoard({ patients, locations }: { patients: PatientWithStage[]; locations: TheatreConfiguration }) {
  const router = useRouter();
  const refreshBoard = React.useCallback(() => router.refresh(), [router]);
  const [selectedSuiteId, setSelectedSuiteId] = React.useState(locations.suites[0]?.id ?? "all");
  const [selectedTheatreId, setSelectedTheatreId] = React.useState("all");
  useRealtimeWorkflow(refreshBoard);

  React.useEffect(() => {
    const intervalId = window.setInterval(refreshBoard, 15_000);
    return () => window.clearInterval(intervalId);
  }, [refreshBoard]);

  const unresolvedPatients = patients.filter((patient) => patient.unresolved);
  const livePatients = patients.filter((patient) => !patient.unresolved);
  const suiteTheatres = locations.theatres.filter((theatre) => selectedSuiteId === "all" || theatre.suite_id === selectedSuiteId);
  const displayedSuites = locations.suites
    .filter((suite) => selectedSuiteId === "all" || suite.id === selectedSuiteId)
    .map((suite) => ({ ...suite, theatres: suiteTheatres.filter((theatre) => theatre.suite_id === suite.id) }));
  const suiteTheatreIds = new Set(suiteTheatres.map((theatre) => theatre.id));
  const selectedPatients = livePatients.filter((patient) =>
    selectedTheatreId === "unassigned"
      ? !patient.theatre_id
      : selectedTheatreId === "all"
        ? selectedSuiteId === "all" ? !patient.theatre_id || suiteTheatreIds.has(patient.theatre_id) : Boolean(patient.theatre_id && suiteTheatreIds.has(patient.theatre_id))
        : patient.theatre_id === selectedTheatreId
  );
  const selectedRecoveryAreas = locations.recovery_areas.filter((area) => selectedSuiteId === "all" || area.suite_id === selectedSuiteId);

  function selectSuite(value: string) {
    setSelectedSuiteId(value);
    setSelectedTheatreId("all");
  }

  return (
    <div className="space-y-4">
      {unresolvedPatients.length ? (
        <section className="rounded-lg border border-red-400 bg-red-50 p-4 text-red-950 dark:border-red-800 dark:bg-red-950/35 dark:text-red-50" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-bold">{unresolvedPatients.length} unresolved case{unresolvedPatients.length === 1 ? "" : "s"} require review</h2>
                <p className="mt-1 text-sm">These patients are withheld from the normal theatre columns until their current stage is confirmed.</p>
              </div>
            </div>
            <Link href="/patients#unresolved-cases" className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:ring-4 focus-visible:ring-red-300">
              Review unresolved cases
            </Link>
          </div>
        </section>
      ) : null}

      <Card className="border-cyan-300 dark:border-cyan-900">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" aria-hidden="true" />Theatre overview</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Choose a suite, then view all theatres together or isolate one theatre and its recovery flow.</p>
            </div>
            <div className="w-full space-y-2 lg:w-80">
              <Label htmlFor="suite-selector">Theatre suite</Label>
              <Select id="suite-selector" value={selectedSuiteId} onChange={(event) => selectSuite(event.target.value)}>
                {locations.suites.length > 1 ? <option value="all">All accessible suites</option> : null}
                {locations.suites.map((suite) => <option key={suite.id} value={suite.id}>{suite.name}</option>)}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-5">
            {displayedSuites.map((suite) => (
              <section key={suite.id} aria-labelledby={`theatre-overview-${suite.id}`}>
                <h3 id={`theatre-overview-${suite.id}`} className="mb-3 text-base font-bold">{suite.name}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 min-[900px]:grid-cols-5">
                  {suite.theatres.map((theatre) => {
                    const theatrePatients = livePatients.filter((patient) => patient.theatre_id === theatre.id);
                    const delayed = theatrePatients.filter((patient) => patient.stage.board_band !== "Ward" && patient.delay_status !== "green").length;
                    const operating = theatrePatients.filter((patient) => patient.stage.board_band === "Operating").length;
                    const recovery = theatrePatients.filter((patient) => patient.stage.board_band === "Recovery").length;
                    const selected = selectedTheatreId === theatre.id;
                    return (
                      <button key={theatre.id} type="button" aria-pressed={selected} aria-label={`${theatre.name}, ${suite.name}. ${selected ? "Deselect theatre and show all theatres" : "Select theatre"}`} onClick={() => setSelectedTheatreId((current) => current === theatre.id ? "all" : theatre.id)} className={cn("clinical-card min-h-36 cursor-pointer rounded-lg border bg-card p-3 text-left transition-colors duration-200 hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30", selected && "border-primary bg-cyan-50 ring-2 ring-primary/20 dark:bg-cyan-950/25")}>
                        <div><p className="whitespace-nowrap font-bold">{theatre.name}</p><Badge tone={delayed ? "amber" : "green"} className="mt-2 px-2">{delayed ? `${delayed} delayed` : "On track"}</Badge></div>
                        <div className="mt-3 grid grid-cols-3 gap-1 text-center"><BoardStat label="Active" value={theatrePatients.length} /><BoardStat label="In theatre" value={operating} /><BoardStat label="Recovery" value={recovery} /></div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {bandRows.map((row) => (
          <div key={row.join("-")} className={cn("grid grid-cols-1 gap-3", row.length === 2 && "md:grid-cols-2")}>
            {row.map((band) => (
              <WorkflowBandList
                key={band}
                band={band}
                patients={selectedPatients.filter((patient) => patient.stage.board_band === band)}
                theatres={locations.theatres}
              />
            ))}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" aria-hidden="true" />Recovery areas</CardTitle><p className="text-sm text-muted-foreground">Recovery occupancy follows each patient&apos;s assigned recovery area and remains linked to their theatre suite.</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {selectedRecoveryAreas.map((area) => {
            const recoveryPatients = selectedPatients.filter((patient) => patient.stage.board_band === "Recovery" && patient.recovery_area_id === area.id);
            const suite = locations.suites.find((item) => item.id === area.suite_id);
            return (
              <section key={area.id} className="clinical-card rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{area.name}</h3><p className="text-sm text-muted-foreground">{suite?.name} suite</p></div><Badge tone={area.capacity && recoveryPatients.length >= area.capacity ? "red" : "green"}>{recoveryPatients.length}{area.capacity ? ` / ${area.capacity}` : ""}</Badge></div>
                <div className="mt-3 space-y-2">{recoveryPatients.map((patient) => <div key={patient.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"><span className="font-bold">{patient.hospital_number}</span><span>{locations.theatres.find((item) => item.id === patient.theatre_id)?.name}</span></div>)}{!recoveryPatients.length ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No patients currently in this recovery area.</p> : null}</div>
              </section>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function BoardStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0"><p className="text-lg font-bold leading-tight">{value}</p><p className="text-[11px] leading-tight text-muted-foreground">{label}</p></div>;
}

function WorkflowBandList({ band, patients, theatres }: { band: WorkflowBand; patients: PatientWithStage[]; theatres: Theatre[] }) {
  const heading = band === "Operating" ? "Theatre" : band === "Ward" ? "Completed patients" : band;
  const showsActiveStageTimer = band !== "Ward";
  const showsAutomaticDelayStatus = band !== "Waiting" && band !== "Ward";

  return (
    <section data-workflow-band={band} className="clinical-card min-h-32 rounded-lg border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-normal text-muted-foreground">{heading}</h2>
        <Badge tone="blue">{patients.length}</Badge>
      </div>
      <div className="space-y-2">
        {patients.map((patient, index) => {
          const theatre = theatres.find((item) => item.id === patient.theatre_id);
          return (
            <div key={patient.id} className="flex min-w-0 items-start gap-2">
              {band === "Waiting" ? <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary bg-cyan-50 text-sm font-bold text-primary dark:bg-cyan-950/40" aria-label={`Waiting list position ${index + 1}`}>{index + 1}</span> : null}
              <Card className={cn("min-w-0 flex-1 space-y-1.5 p-2.5", showsAutomaticDelayStatus && delayClasses(patient.delay_status))}>
                <div className="flex min-w-0 items-center gap-2">
                  <p className="shrink-0 font-bold" title={patient.hospital_number}>{patient.hospital_number}</p>
                  <span className="text-muted-foreground" aria-hidden="true">·</span>
                  <p className="truncate text-sm font-medium" title={patient.procedure}>{patient.procedure}</p>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={patient.consultant}>{shortConsultantName(patient.consultant)}</span>
                  <span className="flex shrink-0 items-center justify-end gap-1">
                    <Badge tone="blue" className="px-2 py-0.5" aria-label={theatre ? theatre.name : "Theatre unassigned"}>{theatre ? `T${theatre.display_order}` : "T—"}</Badge>
                    <Badge tone={priorityTone(patient.cepod_priority)} className="px-2 py-0.5" aria-label={`Priority ${priorityLabel(patient.cepod_priority)}`}>{priorityLabel(patient.cepod_priority)}</Badge>
                    {showsActiveStageTimer ? <Badge className="gap-1 px-2 py-0.5" aria-label={band === "Waiting" ? `${patient.elapsed_minutes} minutes waiting; no automatic time limit` : `${patient.elapsed_minutes} minutes in current stage`}><Clock className="h-3.5 w-3.5" aria-hidden="true" />{patient.elapsed_minutes}m</Badge> : null}
                  </span>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function shortConsultantName(name: string) {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 2 || trimmed.includes("/")) return trimmed;

  const surnameParticles = new Set(["da", "de", "del", "der", "du", "la", "le", "van", "von", "st", "st."]);
  let surnameStart = parts.length - 1;
  while (surnameStart > 1 && surnameParticles.has(parts[surnameStart - 1].toLowerCase())) surnameStart -= 1;
  return `${parts[0]} ${parts.slice(surnameStart).join(" ")}`;
}
