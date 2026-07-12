import { FileDown } from "lucide-react";
import { PatientReportTable } from "@/components/reports/patient-report-table";
import { getDelayReasons, getTodaysPatients, getWorkflowEvents } from "@/lib/repositories/workflow-repository";

export default async function ReportsPage() {
  const [patients, events, delayReasons] = await Promise.all([getTodaysPatients(), getWorkflowEvents(), getDelayReasons()]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-normal">Reports</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Export filtered CEPOD audit data as PDF, CSV or Excel.</p>
      </section>
      <PatientReportTable patients={patients} events={events} delayReasons={delayReasons} />
    </div>
  );
}
