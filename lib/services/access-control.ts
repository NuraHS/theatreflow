import "server-only";

import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/constants/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/domain";

const rolePermissionsEnforced = process.env.THEATREFLOW_ENFORCE_ROLE_PERMISSIONS === "true";

export async function getCurrentUserRole(): Promise<UserRole> {
  if (!rolePermissionsEnforced) return "administrator";

  const supabase = await createServerSupabaseClient();
  if (!supabase) return "theatre_staff";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "theatre_staff";

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return (data?.role as UserRole | undefined) ?? "theatre_staff";
}

export function isRolePermissionEnforced() {
  return rolePermissionsEnforced;
}

export async function hasPermission(permission: Permission) {
  if (!rolePermissionsEnforced) return true;
  return can(await getCurrentUserRole(), permission);
}

export async function requirePagePermission(permission: Permission) {
  if (!(await hasPermission(permission))) redirect("/patients");
}
