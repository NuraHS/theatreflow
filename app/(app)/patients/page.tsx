import { Activity, AlertTriangle, Bell } from "lucide-react";
import { CepodWorkflow } from "@/components/workflow/cepod-workflow";
import { PatientCreateForm } from "@/components/workflow/patient-create-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActivePatients, getDelayReasons, getInfrastructureEvents, getWorkflowStages } from "@/lib/repositories/workflow-repository";
import { getTheatreConfiguration } from "@/lib/repositories/theatre-repository";
import { hasPermission, requirePagePermission } from "@/lib/services/access-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PatientsPage() {
  await requirePagePermission("viewPatients");
  const [patients, delayReasons, infrastructureEvents, stages, locations, canCreatePatients] = await Promise.all([
    getActivePatients(),
    getDelayReasons(),
    getInfrastructureEvents(),
    getWorkflowStages(),
    getTheatreConfiguration(),
    hasPermission("createPatients")
  ]);
  const activeInfrastructure = infrastructureEvents.filter((event) => event.active);
  const today = new Date().toISOString().slice(0, 10);
  const cepodPatients = patients.filter((patient) => (patient.operation_date ?? patient.created_at.slice(0, 10)) <= today);
  const unresolvedPatients = patients.filter((patient) => patient.unresolved);

  return (
    <div className="space-y-5">
      <section className="clinical-card rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-normal">Today&apos;s CEPOD Patients</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Mobile-first workflow capture with automatic timestamps.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={unresolvedPatients.length ? "red" : "green"} className="gap-1">
              {unresolvedPatients.length ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {unresolvedPatients.length} unresolved
            </Badge>
            <Badge tone={cepodPatients.some((patient) => patient.delay_status === "red") ? "red" : "green"}>
              {cepodPatients.filter((patient) => patient.delay_status !== "green").length} delayed
            </Badge>
            <Badge tone={activeInfrastructure.length ? "amber" : "green"}>
              {activeInfrastructure.length} active infrastructure events
            </Badge>
          </div>
        </div>
      </section>

      {activeInfrastructure.length ? (
        <Card className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" aria-hidden="true" />
              Live notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeInfrastructure.map((event) => (
              <p key={event.id} className="text-sm font-medium">{event.type}: {event.description}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <CepodWorkflow
        patients={patients}
        stages={stages}
        delayReasons={delayReasons}
        todayIso={new Date().toISOString()}
        createPatient={canCreatePatients ? <PatientCreateForm suites={locations.suites} theatres={locations.theatres} recoveryAreas={locations.recovery_areas} /> : null}
      />
    </div>
  );
}
