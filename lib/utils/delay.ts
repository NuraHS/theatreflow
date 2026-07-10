import type { PatientWithStage } from "@/lib/types/domain";

export function getDelayStatus(elapsed: number, threshold: number): PatientWithStage["delay_status"] {
  if (elapsed >= threshold * 1.5) return "red";
  if (elapsed >= threshold) return "amber";
  return "green";
}

export function delayClasses(status: PatientWithStage["delay_status"]) {
  if (status === "red") return "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/35 dark:text-red-100";
  if (status === "amber") return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100";
  return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100";
}
