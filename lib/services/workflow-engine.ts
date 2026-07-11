import type { InfrastructureEvent, WorkflowStage } from "@/lib/types/domain";

export function getStageByIdOrName(stages: WorkflowStage[], currentStageIdOrName: string) {
  const normalised = normaliseStageValue(currentStageIdOrName);
  return stages.find((stage) => stage.id === currentStageIdOrName || normaliseStageValue(stage.name) === normalised) ?? null;
}

export function getNextStage(stages: WorkflowStage[], currentStageIdOrName: string) {
  const ordered = [...stages].sort((a, b) => a.display_order - b.display_order);
  const currentStage = getStageByIdOrName(ordered, currentStageIdOrName);
  const index = currentStage ? ordered.findIndex((stage) => stage.id === currentStage.id) : -1;
  if (index === -1) return null;
  return ordered[index + 1] ?? null;
}

export function activeInfrastructureEventIds(events: InfrastructureEvent[], timestamp = new Date()) {
  return events
    .filter((event) => {
      const start = Date.parse(event.start_time);
      const end = event.end_time ? Date.parse(event.end_time) : Number.POSITIVE_INFINITY;
      return event.active && start <= timestamp.getTime() && timestamp.getTime() <= end;
    })
    .map((event) => event.id);
}

export function requiresDelayCapture(elapsedMinutes: number, stage: WorkflowStage) {
  return elapsedMinutes > stage.delay_threshold_minutes;
}

function normaliseStageValue(value: string) {
  return value.trim().toLowerCase().replaceAll("-", " ").replace(/\s+/g, " ");
}
