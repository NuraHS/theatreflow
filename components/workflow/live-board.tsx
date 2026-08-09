"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRealtimeWorkflow } from "@/hooks/use-realtime-workflow";
import type { PatientWithStage, WorkflowBand } from "@/lib/types/domain";
import { delayClasses } from "@/lib/utils/delay";
import { cn } from "@/lib/utils/cn";
import { priorityLabel, priorityTone } from "@/lib/utils/priority";

const bands: WorkflowBand[] = ["Waiting", "Sent For", "Arrived", "Anaesthetic", "Operating", "Recovery", "Ward"];

export function LiveBoard({ patients }: { patients: PatientWithStage[] }) {
  const router = useRouter();
  const refreshBoard = React.useCallback(() => router.refresh(), [router]);
  useRealtimeWorkflow(refreshBoard);

  React.useEffect(() => {
    const intervalId = window.setInterval(refreshBoard, 15_000);
    return () => window.clearInterval(intervalId);
  }, [refreshBoard]);

  const unresolvedPatients = patients.filter((patient) => patient.unresolved);
  const livePatients = patients.filter((patient) => !patient.unresolved);

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

      <div className="grid gap-3 xl:grid-cols-7">
      {bands.map((band) => {
        const bandPatients = livePatients.filter((patient) => patient.stage.board_band === band);
        return (
          <section key={band} className="min-h-64 rounded-lg border bg-muted/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-normal text-muted-foreground">{band}</h2>
              <Badge tone="blue">{bandPatients.length}</Badge>
            </div>
            <div className="space-y-3">
              {bandPatients.map((patient) => (
                <Card key={patient.id} className={cn("p-3", delayClasses(patient.delay_status))}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{patient.hospital_number}</p>
                      <p className="line-clamp-2 text-sm">{patient.procedure}</p>
                    </div>
                    <Badge tone={priorityTone(patient.cepod_priority)}>{priorityLabel(patient.cepod_priority)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{patient.consultant}</span>
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {patient.elapsed_minutes}m
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
