import { Clock, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AdvancePatientButton } from "@/components/workflow/advance-patient-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DelayReason, PatientWithStage } from "@/lib/types/domain";
import { delayClasses } from "@/lib/utils/delay";
import { formatClock } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";

export function PatientCard({ patient, delayReasons }: { patient: PatientWithStage; delayReasons: DelayReason[] }) {
  return (
    <Card className={cn("overflow-hidden", delayClasses(patient.delay_status))}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{patient.hospital_number}</CardTitle>
            <p className="mt-1 text-sm font-medium">{patient.procedure}</p>
          </div>
          <Badge tone={patient.delay_status === "red" ? "red" : patient.delay_status === "amber" ? "amber" : "green"}>
            {patient.cepod_priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Consultant</dt>
            <dd className="font-semibold">{patient.consultant}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Specialty</dt>
            <dd className="font-semibold">{patient.specialty}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Current stage</dt>
            <dd className="font-semibold">{patient.stage.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Elapsed</dt>
            <dd className="flex items-center gap-1 font-semibold">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {patient.elapsed_minutes}m
            </dd>
          </div>
        </dl>
        <div className="flex items-center justify-between rounded-md border bg-background/70 p-3 text-sm">
          <span>Last timestamp</span>
          <span className="font-semibold">{patient.last_event ? formatClock(patient.last_event.timestamp) : formatClock(patient.created_at)}</span>
        </div>
        <AdvancePatientButton patient={patient} delayReasons={delayReasons} />
        <details className="rounded-md border bg-background/60 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4" aria-hidden="true" />
            Patient QR
          </summary>
          <div className="mt-3 flex justify-center rounded-md bg-white p-3">
            <QRCodeSVG value={`/patients?hospital=${patient.hospital_number}`} size={112} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
