import { Settings } from "lucide-react";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getDelayReasons, getWorkflowStages } from "@/lib/repositories/workflow-repository";

export default async function SettingsPage() {
  const [stages, delayReasons] = await Promise.all([getWorkflowStages(), getDelayReasons()]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-normal">Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Administrator configuration for reusable workflows, thresholds, colours and lookup tables.</p>
      </section>
      <SettingsPanel stages={stages} delayReasons={delayReasons} />
    </div>
  );
}
