import { BarChart3 } from "lucide-react";
import { DashboardCharts } from "@/components/dashboards/dashboard-charts";
import { DashboardFilters } from "@/components/dashboards/dashboard-filters";
import { MetricCard } from "@/components/dashboards/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { getDelayReasons, getInfrastructureEvents, getTodaysPatients, getWorkflowEvents } from "@/lib/repositories/workflow-repository";
import { buildExecutiveMetrics } from "@/lib/services/analytics";

const tabs = [
  { value: "executive", label: "Executive" },
  { value: "delay", label: "Delay" },
  { value: "efficiency", label: "Theatre Efficiency" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "consultant", label: "Consultant" },
  { value: "anaesthetic", label: "Anaesthetic" },
  { value: "recovery", label: "Recovery" }
];

export default async function DashboardsPage() {
  const [patients, events, delayReasons, infrastructureEvents] = await Promise.all([
    getTodaysPatients(),
    getWorkflowEvents(),
    getDelayReasons(),
    getInfrastructureEvents()
  ]);
  const metrics = buildExecutiveMetrics(patients, events);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-normal">Dashboards</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Operational performance, delay patterns, infrastructure impact and specialty views.</p>
      </section>
      <DashboardFilters />
      <Tabs tabs={tabs} defaultValue="executive">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
          <DashboardCharts patients={patients} events={events} delayReasons={delayReasons} infrastructureEvents={infrastructureEvents} />
        </div>
      </Tabs>
    </div>
  );
}
