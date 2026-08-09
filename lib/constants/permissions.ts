import type { UserRole } from "@/lib/types/domain";

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  theatre_coordinator: "Theatre Coordinator",
  service_manager: "Service Manager",
  clinical_lead: "Clinical Lead",
  theatre_manager: "Theatre Manager",
  divisional_leadership: "Divisional Leadership",
  manager: "Manager (legacy)",
  consultant: "Consultant",
  theatre_staff: "Theatre Staff",
  read_only_auditor: "Read-only Auditor"
};

export const ASSIGNABLE_ROLES: UserRole[] = [
  "theatre_staff",
  "theatre_coordinator",
  "service_manager",
  "clinical_lead",
  "theatre_manager",
  "divisional_leadership",
  "administrator"
];

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  theatre_staff: "Today's list and live status for assigned theatres.",
  theatre_coordinator: "All theatres and recovery areas in assigned suites for the day.",
  service_manager: "Longitudinal operational performance and reports.",
  clinical_lead: "Clinical and specialty-level performance metrics.",
  theatre_manager: "Operational oversight of assigned theatre suites.",
  divisional_leadership: "High-level cross-service analytics and reports.",
  administrator: "User, configuration and technical system administration.",
  manager: "Legacy manager role with broad operational access.",
  consultant: "Legacy clinical role with patient and performance access.",
  read_only_auditor: "Legacy read-only reporting and audit access."
};

export const PERMISSIONS = {
  viewPatients: ["administrator", "theatre_manager", "theatre_coordinator", "service_manager", "clinical_lead", "theatre_staff", "manager", "consultant", "read_only_auditor"],
  viewLiveBoard: ["administrator", "theatre_manager", "theatre_coordinator", "service_manager", "clinical_lead", "theatre_staff", "manager", "consultant"],
  advanceWorkflow: ["administrator", "theatre_manager", "theatre_coordinator", "clinical_lead", "theatre_staff", "manager", "consultant"],
  createPatients: ["administrator", "theatre_manager", "theatre_coordinator", "clinical_lead", "theatre_staff", "manager", "consultant"],
  viewDashboards: ["administrator", "theatre_manager", "theatre_coordinator", "service_manager", "clinical_lead", "divisional_leadership", "manager", "consultant", "read_only_auditor"],
  manageSettings: ["administrator"],
  manageUsers: ["administrator"],
  exportReports: ["administrator", "theatre_manager", "service_manager", "clinical_lead", "manager", "read_only_auditor"],
  viewSystemHealth: ["administrator"],
  viewSystemDiagnostics: ["administrator"]
} satisfies Record<string, UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole, permission: Permission) {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}
