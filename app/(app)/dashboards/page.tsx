import { BarChart3 } from "lucide-react";
import { DashboardCharts } from "@/components/dashboards/dashboard-charts";
import { getDelayReasons, getTodaysPatients, getWorkflowEvents } from "@/lib/repositories/workflow-repository";

export default async function DashboardsPage() {
  const [patients, events, delayReasons] = await Promise.all([
    getTodaysPatients(),
    getWorkflowEvents(),
    getDelayReasons()
  ]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-normal">Dashboards</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Operational performance, delay patterns, infrastructure impact and specialty views.</p>
      </section>
      <DashboardCharts patients={patients} events={events} delayReasons={delayReasons} />
    </div>
  );
}
