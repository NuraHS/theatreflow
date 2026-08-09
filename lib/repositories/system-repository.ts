import "server-only";

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { SystemHealthReport, SystemHealthSnapshot, SystemIncident, SystemMaintenanceEvent } from "@/lib/types/system-health";

export async function getSystemIncidents(limit = 100): Promise<SystemIncident[]> {
  const supabase = await getSystemClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("system_incidents").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data as SystemIncident[];
}

export async function getSystemHealthSnapshots(limit = 100): Promise<SystemHealthSnapshot[]> {
  const supabase = await getSystemClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("system_health_snapshots").select("*").order("checked_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data as SystemHealthSnapshot[];
}

export async function getSystemMaintenanceEvents(limit = 100): Promise<SystemMaintenanceEvent[]> {
  const supabase = await getSystemClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("system_maintenance_events").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data as SystemMaintenanceEvent[];
}

export async function getKnownSchemaMigrations() {
  const supabase = await getSystemClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("theatreflow_schema_migrations").select("version,name,applied_at").order("version", { ascending: false });
  if (error || !data) return [];
  return data as Array<{ version: string; name: string; applied_at: string }>;
}

export async function createSystemIncident(input: {
  occurred_at: string;
  component: SystemIncident["component"];
  severity: SystemIncident["severity"];
  summary: string;
  details?: string | null;
}) {
  const supabase = await getSystemClient();
  if (!supabase) return { data: null, error: "Database is not configured." };
  const recordedBy = await getCurrentUserId();
  const { data, error } = await supabase.from("system_incidents").insert({
    ...input,
    details: input.details || null,
    status: "open",
    recorded_by: recordedBy
  }).select("*").single();
  return { data: data as SystemIncident | null, error: error?.message ?? null };
}

export async function updateSystemIncident(input: {
  id: string;
  status: SystemIncident["status"];
  resolution_notes?: string | null;
}) {
  const supabase = await getSystemClient();
  if (!supabase) return { data: null, error: "Database is not configured." };
  const resolved = input.status === "resolved";
  const { data, error } = await supabase.from("system_incidents").update({
    status: input.status,
    resolution_notes: input.resolution_notes || null,
    resolved_at: resolved ? new Date().toISOString() : null
  }).eq("id", input.id).select("*").single();
  return { data: data as SystemIncident | null, error: error?.message ?? null };
}

export async function recordSystemHealthSnapshot(report: SystemHealthReport) {
  const supabase = await getSystemClient();
  if (!supabase) return { data: null, error: "Database is not configured." };
  const { data, error } = await supabase.from("system_health_snapshots").insert({
    checked_at: report.generated_at,
    overall_status: report.overall_status,
    application_status: "healthy",
    database_status: report.database.status,
    authentication_status: report.authentication.status,
    storage_status: report.storage.status,
    database_size_bytes: report.database.size_bytes,
    storage_total_bytes: report.storage.total_bytes,
    storage_used_bytes: report.storage.used_bytes,
    app_version: report.application.version,
    critical_incidents_24h: report.activity.critical_incidents_24h,
    warnings_24h: report.activity.warnings_24h,
    details: report
  }).select("*").single();
  return { data: data as SystemHealthSnapshot | null, error: error?.message ?? null };
}

async function getSystemClient() {
  return createServiceRoleSupabaseClient() ?? await createServerSupabaseClient();
}

async function getCurrentUserId() {
  const authSupabase = await createServerSupabaseClient();
  if (!authSupabase) return null;
  const { data: { user } } = await authSupabase.auth.getUser();
  return user?.id ?? null;
}
