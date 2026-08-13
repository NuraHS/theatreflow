"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DelayReason, PatientWithStage, WorkflowStage } from "@/lib/types/domain";
import { requiresDelayCapture } from "@/lib/services/workflow-engine";

export function AdvancePatientButton({
  patient,
  delayReasons,
  nextStage,
  elapsedMinutes
}: {
  patient: PatientWithStage;
  delayReasons: DelayReason[];
  nextStage: WorkflowStage | null;
  elapsedMinutes?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [delay, setDelay] = React.useState<"yes" | "no" | null>(null);
  const [selectedReasons, setSelectedReasons] = React.useState<string[]>([]);
  const [comments, setComments] = React.useState("");
  const [stageStartedAt, setStageStartedAt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const currentElapsedMinutes = elapsedMinutes ?? patient.elapsed_minutes;
  const needsDelay = requiresDelayCapture(currentElapsedMinutes, patient.stage);
  const hasNoAutomaticLimit = patient.stage.delay_threshold_minutes <= 0;
  const noAutomaticLimitMessage = getNoAutomaticLimitMessage(patient.stage);

  async function advance(reasonIds = selectedReasons, delayComments = comments) {
    setLoading(true);
    const response = await fetch("/api/workflow/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patient.id,
        current_stage_id: patient.current_stage,
        delay_reason_ids: reasonIds,
        delay_comments: delayComments,
        stage_started_at: stageStartedAt ? new Date(stageStartedAt).toISOString() : new Date().toISOString()
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
    setStageStartedAt("");
    router.refresh();
  }

  function onPrimaryClick() {
    if (!nextStage) return;
    setDelay(needsDelay ? null : "no");
    setStageStartedAt(toDateTimeLocal(new Date()));
    setOpen(true);
  }

  function toggleReason(id: string) {
    setSelectedReasons((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <>
      <Button type="button" size="lg" className="w-full" onClick={onPrimaryClick} disabled={loading || !nextStage}>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
        {loading ? "Recording..." : nextStage ? nextStage.name : "Workflow complete"}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-cyan-950/40 p-3 sm:items-center sm:justify-center">
          <div
            aria-labelledby={`record-stage-title-${patient.id}`}
            aria-modal="true"
            className="max-h-[92vh] w-full overflow-y-auto rounded-lg border bg-background p-4 shadow-2xl sm:max-w-2xl sm:p-5"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" id={`record-stage-title-${patient.id}`}>
                  Record {nextStage?.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hasNoAutomaticLimit
                    ? noAutomaticLimitMessage
                    : `${currentElapsedMinutes} minutes elapsed in ${patient.stage.name}. Threshold is ${patient.stage.delay_threshold_minutes} minutes.`}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close workflow update" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <label htmlFor={`stage-started-${patient.id}`} className="mt-4 block text-sm font-semibold">
              Amend start time
              <Input
                id={`stage-started-${patient.id}`}
                type="datetime-local"
                max={toDateTimeLocal(new Date())}
                value={stageStartedAt}
                onChange={(event) => setStageStartedAt(event.target.value)}
                className="mt-1"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Defaults to the current time. Change it if this stage was recorded late.</span>
            </label>

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
                Record timestamp and mark {nextStage?.name}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getNoAutomaticLimitMessage(stage: WorkflowStage) {
  if (stage.id === "patient-on-list") {
    return "There is no automatic time limit while this patient is waiting for surgery. Record a delay only if an issue prevented the patient from being sent for.";
  }
  if (stage.id === "anaesthetic-started") {
    return "Anaesthesia can take as long as clinically required, so there is no automatic time limit. Record a delay only if a specific issue affected this stage.";
  }
  if (stage.id === "operation-started") {
    return "An operation can take as long as clinically required, so there is no automatic time limit. Record a delay only if a specific issue affected this stage.";
  }
  return `There is no automatic time limit during ${stage.name}. Record a delay only if a specific issue affected this stage.`;
}

function toDateTimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
