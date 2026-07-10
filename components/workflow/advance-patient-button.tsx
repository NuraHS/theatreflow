"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { DelayReason, PatientWithStage } from "@/lib/types/domain";
import { requiresDelayCapture } from "@/lib/services/workflow-engine";

export function AdvancePatientButton({ patient, delayReasons }: { patient: PatientWithStage; delayReasons: DelayReason[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [delay, setDelay] = React.useState<"yes" | "no" | null>(null);
  const [selectedReasons, setSelectedReasons] = React.useState<string[]>([]);
  const [comments, setComments] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const needsDelay = requiresDelayCapture(patient.elapsed_minutes, patient.stage);

  async function advance(reasonIds = selectedReasons, delayComments = comments) {
    setLoading(true);
    const response = await fetch("/api/workflow/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patient.id,
        current_stage_id: patient.current_stage,
        delay_reason_ids: reasonIds,
        delay_comments: delayComments
      })
    });
    const result = (await response.json()) as { error?: string; demo?: boolean };
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error ?? "Unable to advance patient");
      return;
    }

    toast.success(result.demo ? "Demo advance recorded." : "Patient advanced.");
    setOpen(false);
    setDelay(null);
    setSelectedReasons([]);
    setComments("");
    router.refresh();
  }

  function onPrimaryClick() {
    if (needsDelay) {
      setOpen(true);
      return;
    }
    void advance([], "");
  }

  function toggleReason(id: string) {
    setSelectedReasons((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <>
      <Button type="button" size="lg" className="w-full" onClick={onPrimaryClick} disabled={loading}>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
        {loading ? "Advancing..." : "Advance to Next Stage"}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-cyan-950/40 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-lg border bg-background p-4 shadow-2xl sm:max-w-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Delay capture</h2>
                <p className="text-sm text-muted-foreground">
                  {patient.elapsed_minutes} minutes elapsed in {patient.stage.name}. Threshold is {patient.stage.delay_threshold_minutes} minutes.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close delay capture" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant={delay === "yes" ? "default" : "outline"} onClick={() => setDelay("yes")}>Delay: Yes</Button>
              <Button type="button" variant={delay === "no" ? "default" : "outline"} onClick={() => setDelay("no")}>Delay: No</Button>
            </div>

            {delay === "yes" ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {delayReasons.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => toggleReason(reason.id)}
                      className="min-h-11 cursor-pointer rounded-md border px-3 text-sm font-semibold transition-colors hover:bg-muted data-[selected=true]:border-primary data-[selected=true]:bg-secondary"
                      data-selected={selectedReasons.includes(reason.id)}
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={`comments-${patient.id}`} className="text-sm font-medium">Comments</label>
                    <Badge tone="blue" className="gap-1">
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      Voice-ready field
                    </Badge>
                  </div>
                  <Textarea
                    id={`comments-${patient.id}`}
                    value={comments}
                    onChange={(event) => setComments(event.target.value)}
                    placeholder="Optional delay comments"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={loading || delay === null || (delay === "yes" && selectedReasons.length === 0)}
                onClick={() => void advance(delay === "yes" ? selectedReasons : [], delay === "yes" ? comments : "")}
              >
                Record timestamp and advance
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
