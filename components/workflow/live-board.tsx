"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BedDouble, Building2, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useRealtimeWorkflow } from "@/hooks/use-realtime-workflow";
import type { PatientWithStage, TheatreConfiguration, WorkflowBand } from "@/lib/types/domain";
import { delayClasses } from "@/lib/utils/delay";
import { cn } from "@/lib/utils/cn";
import { priorityLabel, priorityTone } from "@/lib/utils/priority";

const bands: WorkflowBand[] = ["Waiting", "Sent For", "Arrived", "Anaesthetic", "Operating", "Recovery", "Ward"];

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
  const unassignedCount = livePatients.filter((patient) => !patient.theatre_id).length;
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
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" aria-hidden="true" />Theatre coordinator overview</CardTitle>
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
          <div className="space-y-4" aria-label="Theatre selector">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={selectedTheatreId === "all" ? "default" : "outline"} className="min-h-11" onClick={() => setSelectedTheatreId("all")}>
                All theatres
                <Badge tone={selectedTheatreId === "all" ? "blue" : "neutral"}>{selectedPatients.length}</Badge>
              </Button>
              {unassignedCount ? (
                <Button type="button" variant={selectedTheatreId === "unassigned" ? "default" : "outline"} className="min-h-11" onClick={() => { setSelectedSuiteId("all"); setSelectedTheatreId("unassigned"); }}>
                  Unassigned
                  <Badge tone="amber">{unassignedCount}</Badge>
                </Button>
              ) : null}
            </div>
            {displayedSuites.map((suite) => (
              <section key={suite.id} aria-labelledby={`theatre-selector-${suite.id}`} className={cn(selectedSuiteId === "all" && "rounded-lg border bg-muted/20 p-3")}>
                {selectedSuiteId === "all" ? (
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 id={`theatre-selector-${suite.id}`} className="font-bold">{suite.name}</h3>
                    <Badge tone="neutral">{suite.theatres.length} theatre{suite.theatres.length === 1 ? "" : "s"}</Badge>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {suite.theatres.map((theatre) => {
                    const count = livePatients.filter((patient) => patient.theatre_id === theatre.id).length;
                    return (
                      <Button key={theatre.id} type="button" variant={selectedTheatreId === theatre.id ? "default" : "outline"} className="min-h-11" onClick={() => setSelectedTheatreId(theatre.id)}>
                        {theatre.name}
                        <Badge tone={selectedTheatreId === theatre.id ? "blue" : "neutral"}>{count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-5">
            {displayedSuites.map((suite) => (
              <section key={suite.id} aria-labelledby={`theatre-overview-${suite.id}`}>
                {selectedSuiteId === "all" ? <h3 id={`theatre-overview-${suite.id}`} className="mb-3 text-base font-bold">{suite.name}</h3> : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                  {suite.theatres.map((theatre) => {
                    const theatrePatients = livePatients.filter((patient) => patient.theatre_id === theatre.id);
                    const delayed = theatrePatients.filter((patient) => patient.delay_status !== "green").length;
                    const operating = theatrePatients.filter((patient) => ["Anaesthetic", "Operating"].includes(patient.stage.board_band)).length;
                    const recovery = theatrePatients.filter((patient) => patient.stage.board_band === "Recovery").length;
                    return (
                      <button key={theatre.id} type="button" onClick={() => setSelectedTheatreId(theatre.id)} className={cn("clinical-card cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors duration-200 hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30", selectedTheatreId === theatre.id && "border-primary bg-cyan-50 dark:bg-cyan-950/25")}>
                        <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{theatre.name}</p><p className="text-xs text-muted-foreground">{suite.name}</p></div><Badge tone={delayed ? "amber" : "green"}>{delayed ? `${delayed} delayed` : "On track"}</Badge></div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><BoardStat label="Active" value={theatrePatients.length} /><BoardStat label="In theatre" value={operating} /><BoardStat label="Recovery" value={recovery} /></div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-7">
        {bands.map((band) => {
          const bandPatients = selectedPatients.filter((patient) => patient.stage.board_band === band);
          return (
            <section key={band} className="clinical-card min-h-64 rounded-lg border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-normal text-muted-foreground">{band}</h2>
                <Badge tone="blue">{bandPatients.length}</Badge>
              </div>
              <div className="space-y-3">
                {bandPatients.map((patient) => {
                  const theatre = locations.theatres.find((item) => item.id === patient.theatre_id);
                  return (
                    <Card key={patient.id} className={cn("p-3", delayClasses(patient.delay_status))}>
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="font-bold">{patient.hospital_number}</p><p className="line-clamp-2 text-sm">{patient.procedure}</p></div>
                        <Badge tone={priorityTone(patient.cepod_priority)}>{priorityLabel(patient.cepod_priority)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="blue"><MapPin className="h-3 w-3" aria-hidden="true" />{theatre?.name ?? "Unassigned"}</Badge></div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-sm"><span className="truncate">{patient.consultant}</span><span className="flex items-center gap-1 font-semibold"><Clock className="h-4 w-4" aria-hidden="true" />{patient.elapsed_minutes}m</span></div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
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
  return <div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
