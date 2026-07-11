import type { CepodPriority } from "@/lib/types/domain";

export function normalisePriority(priority: CepodPriority | string) {
  if (priority === "Immediate") return "P1";
  if (priority === "Urgent") return "P2";
  if (priority === "Expedited") return "P3";
  if (priority === "Elective") return "P4";
  return priority;
}

export function priorityTone(priority: CepodPriority | string) {
  const value = normalisePriority(priority);
  if (value === "P1") return "red";
  if (value === "P2") return "amber";
  if (value === "P3") return "green";
  if (value === "P4") return "blue";
  return "neutral";
}

export function priorityLabel(priority: CepodPriority | string) {
  return normalisePriority(priority);
}

export function priorityRowClasses(priority: CepodPriority | string) {
  const value = normalisePriority(priority);
  if (value === "P1") {
    return "border-red-300 bg-red-50 text-red-950 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/35 dark:text-red-100 dark:hover:bg-red-950/50";
  }
  if (value === "P2") {
    return "border-yellow-300 bg-yellow-50 text-yellow-950 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-950/35 dark:text-yellow-100 dark:hover:bg-yellow-950/50";
  }
  if (value === "P3") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100 dark:hover:bg-emerald-950/50";
  }
  if (value === "P4") {
    return "border-blue-300 bg-blue-50 text-blue-950 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100 dark:hover:bg-blue-950/50";
  }
  return "border-border bg-card text-card-foreground hover:bg-muted/60";
}
