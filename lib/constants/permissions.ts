import type { UserRole } from "@/lib/types/domain";

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  manager: "Manager",
  clinical_lead: "Clinical Lead",
  consultant: "Consultant",
  theatre_staff: "Theatre Staff",
  read_only_auditor: "Read-only Auditor"
};

export const PERMISSIONS: Record<string, UserRole[]> = {
  viewPatients: ["administrator", "manager", "clinical_lead", "consultant", "theatre_staff", "read_only_auditor"],
  advanceWorkflow: ["administrator", "manager", "clinical_lead", "consultant", "theatre_staff"],
  createPatients: ["administrator", "manager", "clinical_lead", "consultant", "theatre_staff"],
  viewDashboards: ["administrator", "manager", "clinical_lead", "consultant", "read_only_auditor"],
  manageSettings: ["administrator"],
  exportReports: ["administrator", "manager", "clinical_lead", "read_only_auditor"]
};

export function can(role: UserRole, permission: keyof typeof PERMISSIONS) {
  return PERMISSIONS[permission].includes(role);
}
