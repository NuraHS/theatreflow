import "server-only";

import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/constants/permissions";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { CurrentUserAccess, UserRole } from "@/lib/types/domain";

const rolePermissionsEnforced = process.env.THEATREFLOW_ENFORCE_ROLE_PERMISSIONS === "true";

const demoAdministrator: CurrentUserAccess = {
  id: "demo-administrator",
  email: "demo@theatreflow.local",
  full_name: "Demo Administrator",
  job_title: "Local demonstration",
  role: "administrator",
  active: true,
  primary_suite_id: null,
  suite_ids: [],
  theatre_ids: [],
  authenticated: false,
  all_theatres: true
};

export async function getCurrentUserAccess(): Promise<CurrentUserAccess> {
  if (!rolePermissionsEnforced) return demoAdministrator;

  const authSupabase = await createServerSupabaseClient();
  if (!authSupabase) return unauthenticatedAccess();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return unauthenticatedAccess();

  const serviceSupabase = createServiceRoleSupabaseClient();
  const supabase = serviceSupabase ?? authSupabase;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,job_title,role,active,primary_suite_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = normaliseRole(profile?.role);
  const [suiteAccess, theatreAccess] = await Promise.all([
    supabase.from("profile_suite_access").select("suite_id").eq("profile_id", user.id),
    supabase.from("profile_theatre_access").select("theatre_id").eq("profile_id", user.id)
  ]);
  const suiteIds = unique([
    ...(profile?.primary_suite_id ? [String(profile.primary_suite_id)] : []),
    ...((suiteAccess.data ?? []).map((item) => String(item.suite_id)))
  ]);

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    job_title: profile?.job_title ?? null,
    role,
    active: profile?.active ?? true,
    primary_suite_id: profile?.primary_suite_id ?? null,
    suite_ids: suiteIds,
    theatre_ids: unique((theatreAccess.data ?? []).map((item) => String(item.theatre_id))),
    authenticated: true,
    all_theatres: hasGlobalPatientAccess(role)
  };
}

export async function getCurrentUserRole(): Promise<UserRole> {
  return (await getCurrentUserAccess()).role;
}

export function isRolePermissionEnforced() {
  return rolePermissionsEnforced;
}

export async function hasPermission(permission: Permission) {
  if (!rolePermissionsEnforced) return true;
  const access = await getCurrentUserAccess();
  return access.authenticated && access.active && can(access.role, permission);
}

export async function requirePagePermission(permission: Permission) {
  if (await hasPermission(permission)) return;
  const access = await getCurrentUserAccess();
  redirect(getRoleHome(access.role));
}

export function getRoleHome(role: UserRole) {
  if (can(role, "viewPatients")) return "/patients";
  if (can(role, "viewDashboards")) return "/dashboards";
  return "/login";
}

export async function canAccessTheatre(theatreId: string | null) {
  if (!rolePermissionsEnforced || !theatreId) return true;
  const access = await getCurrentUserAccess();
  if (!access.authenticated || !access.active) return false;
  if (access.all_theatres || access.theatre_ids.includes(theatreId)) return true;
  if (!access.suite_ids.length) return false;

  const supabase = createServiceRoleSupabaseClient() ?? await createServerSupabaseClient();
  if (!supabase) return false;
  const { data } = await supabase.from("theatres").select("suite_id").eq("id", theatreId).maybeSingle();
  return Boolean(data?.suite_id && access.suite_ids.includes(String(data.suite_id)));
}

export async function canAccessPatient(patientId: string) {
  if (!rolePermissionsEnforced) return true;
  const supabase = createServiceRoleSupabaseClient() ?? await createServerSupabaseClient();
  if (!supabase) return false;
  const { data } = await supabase.from("patients").select("theatre_id").eq("id", patientId).maybeSingle();
  if (!data) return false;
  return canAccessTheatre(data.theatre_id ?? null);
}

export function hasGlobalPatientAccess(role: UserRole) {
  return ["administrator", "service_manager", "clinical_lead", "divisional_leadership", "manager", "consultant", "read_only_auditor"].includes(role);
}

function unauthenticatedAccess(): CurrentUserAccess {
  return {
    id: "",
    email: null,
    full_name: null,
    job_title: null,
    role: "theatre_staff",
    active: false,
    primary_suite_id: null,
    suite_ids: [],
    theatre_ids: [],
    authenticated: false,
    all_theatres: false
  };
}

function normaliseRole(value: unknown): UserRole {
  const roles: UserRole[] = [
    "administrator", "theatre_coordinator", "service_manager", "clinical_lead",
    "theatre_manager", "divisional_leadership", "theatre_staff", "manager",
    "consultant", "read_only_auditor"
  ];
  return roles.includes(value as UserRole) ? value as UserRole : "theatre_staff";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
