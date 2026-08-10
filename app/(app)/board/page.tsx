import { MonitorUp } from "lucide-react";
import { LiveBoard } from "@/components/workflow/live-board";
import { getActivePatients } from "@/lib/repositories/workflow-repository";
import { getTheatreConfiguration } from "@/lib/repositories/theatre-repository";
import { requirePagePermission } from "@/lib/services/access-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BoardPage() {
  await requirePagePermission("viewLiveBoard");
  const [patients, locations] = await Promise.all([getActivePatients(), getTheatreConfiguration()]);

  return (
    <div className="space-y-5">
      <section className="clinical-card flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MonitorUp className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-normal">Live Theatre Board</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Realtime column view for desktop displays and coordinators.</p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">Green, amber and red reflect each stage threshold.</p>
      </section>
      <LiveBoard patients={patients} locations={locations} />
    </div>
  );
}
