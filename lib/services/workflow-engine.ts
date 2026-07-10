import type { InfrastructureEvent, WorkflowStage } from "@/lib/types/domain";

export function getNextStage(stages: WorkflowStage[], currentStageId: string) {
  const ordered = [...stages].sort((a, b) => a.display_order - b.display_order);
  const index = ordered.findIndex((stage) => stage.id === currentStageId);
  if (index === -1) return ordered[0] ?? null;
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
