import { HeartPulse } from "lucide-react";
import { SystemHealthPanel } from "@/components/admin/system-health-panel";
import { requirePagePermission } from "@/lib/services/access-control";
import { getSystemHealthReport } from "@/lib/services/system-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SystemHealthPage() {
  await requirePagePermission("viewSystemHealth");
  const report = await getSystemHealthReport();

  return <div className="space-y-5">
    <section className="clinical-card rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" aria-hidden="true" /><h1 className="text-2xl font-bold tracking-normal">Theatreflow System Health</h1></div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Live local monitoring for the application, database, authentication, storage, backups, migrations and certificate lifecycle. No telemetry leaves the Trust.</p>
    </section>
    <SystemHealthPanel initialReport={report} />
  </div>;
}
