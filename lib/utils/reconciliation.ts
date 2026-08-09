const TWENTY_FOUR_HOURS_MINUTES = 24 * 60;
const FORTY_EIGHT_HOURS_MINUTES = 48 * 60;

const unresolvedThresholds: Record<string, number> = {
  "sent-for": TWENTY_FOUR_HOURS_MINUTES,
  "patient-arrived": TWENTY_FOUR_HOURS_MINUTES,
  "anaesthetic-started": TWENTY_FOUR_HOURS_MINUTES,
  "patient-in-theatre": TWENTY_FOUR_HOURS_MINUTES,
  "operation-started": TWENTY_FOUR_HOURS_MINUTES,
  "operation-finished": TWENTY_FOUR_HOURS_MINUTES,
  "patient-in-recovery": FORTY_EIGHT_HOURS_MINUTES
};

export function getUnresolvedThresholdMinutes(stageId: string) {
  return unresolvedThresholds[stageId] ?? null;
}

export function getReconciliationReferenceTime({
  stageStartedAt,
  reviewedAt
}: {
  stageStartedAt: string;
  reviewedAt?: string | null;
}) {
  if (!reviewedAt) return stageStartedAt;
  return Date.parse(reviewedAt) > Date.parse(stageStartedAt) ? reviewedAt : stageStartedAt;
}

export function getReconciliationDueAt(stageId: string, referenceTime: string) {
  const thresholdMinutes = getUnresolvedThresholdMinutes(stageId);
  if (thresholdMinutes === null) return null;
  return new Date(Date.parse(referenceTime) + thresholdMinutes * 60_000).toISOString();
}

export function formatUnresolvedThreshold(thresholdMinutes: number | null) {
  if (thresholdMinutes === null) return "";
  return `${thresholdMinutes / 60} hours`;
}
