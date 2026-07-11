import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PatientWithStage, WorkflowBand } from "@/lib/types/domain";
import { delayClasses } from "@/lib/utils/delay";
import { cn } from "@/lib/utils/cn";
import { priorityLabel, priorityTone } from "@/lib/utils/priority";

const bands: WorkflowBand[] = ["Waiting", "Sent For", "Arrived", "Anaesthetic", "Operating", "Recovery", "Ward"];

export function LiveBoard({ patients }: { patients: PatientWithStage[] }) {
  return (
    <div className="grid gap-3 xl:grid-cols-7">
      {bands.map((band) => {
        const bandPatients = patients.filter((patient) => patient.stage.board_band === band);
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
  );
}
