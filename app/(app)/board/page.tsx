import { MonitorUp } from "lucide-react";
import { LiveBoard } from "@/components/workflow/live-board";
import { getTodaysPatients } from "@/lib/repositories/workflow-repository";

export default async function BoardPage() {
  const patients = await getTodaysPatients();

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MonitorUp className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-normal">Live Theatre Board</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Realtime column view for desktop displays and coordinators.</p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">Green, amber and red reflect each stage threshold.</p>
      </section>
      <LiveBoard patients={patients} />
    </div>
  );
}
