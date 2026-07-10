import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTodaysPatients, getWorkflowEvents } from "@/lib/repositories/workflow-repository";

export default async function InsightsPage() {
  const [patients, events] = await Promise.all([getTodaysPatients(), getWorkflowEvents()]);
  const delayed = patients.filter((patient) => patient.delay_status !== "green").length;
  const recoveryDelays = events.filter((event) => event.delay_reason_ids.includes("recovery-full")).length;
  const transportDelays = events.filter((event) => event.delay_reason_ids.some((id) => ["porter-unavailable", "lift-failure"].includes(id))).length;

  const insights = [
    `Recovery capacity contributed to ${recoveryDelays} recorded delay event${recoveryDelays === 1 ? "" : "s"} in the current dataset.`,
    `${delayed} of ${patients.length} active cases are currently beyond their configured stage threshold.`,
    `Transport-related delay reasons appear in ${transportDelays} workflow event${transportDelays === 1 ? "" : "s"}.`,
    "First-case and monthly trend statements will become more reliable as historical records accumulate."
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-normal">Insights</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Descriptive, data-driven operational patterns. These statements do not make unsupported causal claims.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((insight) => (
          <Card key={insight}>
            <CardHeader>
              <CardTitle>Observed pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold leading-relaxed">{insight}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
