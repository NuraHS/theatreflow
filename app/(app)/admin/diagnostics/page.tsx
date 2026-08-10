import { Stethoscope } from "lucide-react";
import { SystemDiagnosticsPanel } from "@/components/admin/system-diagnostics-panel";
import { getSystemHealthSnapshots, getSystemIncidents } from "@/lib/repositories/system-repository";
import { requirePagePermission } from "@/lib/services/access-control";
import { getSystemHealthReport } from "@/lib/services/system-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SystemDiagnosticsPage() {
  await requirePagePermission("viewSystemDiagnostics");
  const [report, incidents, snapshots] = await Promise.all([
    getSystemHealthReport(),
    getSystemIncidents(),
    getSystemHealthSnapshots()
  ]);

  return <div className="space-y-5">
    <section className="clinical-card rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" /><h1 className="text-2xl font-bold tracking-normal">System Diagnostics</h1></div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Isolate live faults, record patient-data-free technical incidents, document resolutions and compare health over time.</p>
    </section>
    <SystemDiagnosticsPanel initialReport={report} initialIncidents={incidents} initialSnapshots={snapshots} />
  </div>;
}
