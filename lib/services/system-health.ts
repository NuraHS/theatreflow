import "server-only";

import { statfs } from "node:fs/promises";
import { connectionFailure, isManagedHosting } from "@/lib/services/health-diagnostics";
import packageJson from "@/package.json";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { SystemHealthCheck, SystemHealthReport, SystemHealthStatus } from "@/lib/types/system-health";

const EXPECTED_SCHEMA_VERSION = "0019";

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const generatedAt = new Date().toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const [database, authentication, storage, backup, migration, activity, certificate, configuration] = await Promise.all([
    checkDatabase(supabase),
    checkAuthentication(supabase),
    checkStorage(),
    checkBackup(supabase),
    checkMigration(supabase),
    checkTechnicalActivity(supabase),
    checkCertificate(),
    checkConfiguration(supabase)
  ]);

  const rolePermissionsEnforced = process.env.THEATREFLOW_ENFORCE_ROLE_PERMISSIONS === "true";
  const checks: SystemHealthCheck[] = [
    {
      id: "configuration", label: "Theatre configuration", status: configuration.status,
      summary: configuration.source === "database" ? "Locations loaded from the installation database" : configuration.source === "demo-fallback" ? "Using built-in demonstration locations" : "Database configuration unavailable; operational pages may show demo fallback",
      detail: configuration.legacy_locations ? "The database still contains the original theatre names. Apply migration 0018_esth_theatre_locations.sql; deploying code alone does not update database rows." : configuration.source === "database" ? `${configuration.active_suites} active suites and ${configuration.active_theatres} active theatres. Database rows override built-in defaults.` : "Built-in defaults are not evidence of a working database. Confirm the database connection before recording operational data."
    },
    {
      id: "access-control", label: "Access enforcement", status: rolePermissionsEnforced ? "healthy" : "warning",
      summary: rolePermissionsEnforced ? "Role permission checks are enabled" : "Role permission checks are disabled",
      detail: rolePermissionsEnforced ? "Privileged actions require a signed-in active role. Patients, Live Board and Dashboards still have public viewing access under the current access model." : "Unauthenticated users can open administrative tools. This is bootstrap/demo access, not an authenticated administrator session. Enable enforcement after testing an administrator account."
    },
    {
      id: "incidents", label: "Technical incident register", status: activity.status,
      summary: activity.open_incidents === null ? "Incident counts could not be read" : `${activity.open_incidents} recorded open incidents`,
      detail: "Counts describe entries in the technical register, not automatically detected faults. An unavailable register does not mean there are no incidents."
    },
    {
      id: "application",
      label: "Application",
      status: "healthy",
      summary: "Application is responding",
      detail: `Theatreflow ${packageJson.version} is running on Node ${process.version}.`
    },
    {
      id: "database",
      label: "Database",
      status: database.status,
      summary: statusSummary(database.status, "Database connection is healthy", "Database connection needs attention", "Database check failed", "Database is not configured"),
      detail: database.detail ?? (database.latency_ms === null ? "Configure the database URL and server-side service-role key in this installation." : `Query completed in ${database.latency_ms} ms.`),
      latency_ms: database.latency_ms
    },
    {
      id: "authentication",
      label: "Authentication",
      status: authentication.status,
      summary: statusSummary(authentication.status, "Authentication service is healthy", "Authentication needs attention", "Authentication check failed", "Authentication check is unavailable"),
      detail: authentication.detail ?? (authentication.active_users === null ? "Configure the Supabase project URL and server-side service-role key." : `${authentication.active_users} user profiles are configured.`)
    },
    {
      id: "storage",
      label: "Storage",
      status: storage.status,
      summary: storage.utilisation_percent === null ? "Storage utilisation is unavailable" : `${storage.utilisation_percent}% utilised`,
      detail: storage.source
    },
    {
      id: "backup",
      label: "Backup",
      status: backup.status,
      summary: backup.last_success_at ? `Last successful backup ${formatRelativeHours(backup.age_hours)}` : "No successful backup has been recorded",
      detail: isManagedHosting() ? "This checks Theatreflow backup records, not provider-managed backups. Verify backup availability in Supabase." : "Backup events are recorded in Theatreflow and included in the support bundle."
    },
    {
      id: "migration",
      label: "Database migration",
      status: migration.status,
      summary: migration.version ? `${migration.version} — ${migration.name}` : "Migration status is unavailable",
      detail: `Expected migration ${migration.expected_version}. ` + (migration.applied_at ? `Latest recorded migration applied ${new Date(migration.applied_at).toLocaleString("en-GB")}. This reads the migration register; it does not verify every table or prove compatibility.` : "The migration register could not be verified.")
    },
    {
      id: "certificate",
      label: "Certificate",
      status: certificate.status,
      summary: certificate.expires_at ? `${certificate.days_remaining} days remaining` : isManagedHosting() ? "Certificate managed by hosting provider" : "Certificate expiry is not configured",
      detail: certificate.expires_at ? `Expires ${new Date(certificate.expires_at).toLocaleDateString("en-GB", { dateStyle: "long" })}.` : isManagedHosting() ? "HTTPS certificates are managed by the hosting provider; expiry is not measured by this check." : "Set THEATREFLOW_CERTIFICATE_EXPIRES_AT on the local server."
    }
  ];

  return {
    generated_at: generatedAt,
    overall_status: overallStatus(checks),
    deployment_mode: isManagedHosting() ? "Cloud hosting / Supabase" : process.env.THEATREFLOW_DEPLOYMENT_MODE ?? "Local / on-premises ready",
    configuration,
    role_permissions_enforced: rolePermissionsEnforced,
    application: {
      build_id: safeBuildId(),
      version: packageJson.version,
      node_version: process.version,
      uptime_seconds: Math.round(process.uptime()),
      memory_used_bytes: process.memoryUsage().rss
    },
    database,
    storage,
    authentication,
    backup,
    migration,
    certificate,
    activity,
    checks
  };
}

export function publicHealthReport(report: SystemHealthReport) {
  return {
    status: report.overall_status,
    checked_at: report.generated_at,
    version: report.application.version,
    application: "healthy",
    database: report.database.status,
    authentication: report.authentication.status,
    storage: report.storage.status,
    backup: report.backup.status,
    migration: report.migration.status
  };
}

async function checkDatabase(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["database"]> {
  if (!supabase) return { status: "unknown", latency_ms: null, size_bytes: null, connection_count: null, max_connections: null };
  const started = performance.now();
  // A small GET preserves provider error codes; HEAD responses omit the error body.
  const ping = await supabase.from("workflows").select("id").limit(1);
  const latency = Math.max(0, Math.round(performance.now() - started));
  if (ping.error) return { ...connectionFailure(ping.error, ping.status), latency_ms: latency, size_bytes: null, connection_count: null, max_connections: null };

  const metricsResult = await supabase.rpc("get_theatreflow_database_metrics");
  const metrics = asRecord(metricsResult.data);
  return {
    status: latency > 2_000 ? "warning" : "healthy",
    latency_ms: latency,
    size_bytes: asNumber(metrics?.database_size_bytes),
    connection_count: asNumber(metrics?.connection_count),
    max_connections: asNumber(metrics?.max_connections)
  };
}

async function checkAuthentication(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["authentication"]> {
  if (!supabase) return { status: "unknown", active_users: null };
  const [authResult, profilesResult] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
    supabase.from("profiles").select("id", { head: true, count: "exact" })
  ]);
  return {
    ...(authResult.error ? connectionFailure(authResult.error) : profilesResult.error ? { status: "warning" as const, detail: "The authentication admin API responded, but user profiles could not be counted. Check the profiles table and its permissions." } : { status: "healthy" as const }),
    active_users: profilesResult.error ? null : profilesResult.count ?? 0
  };
}

async function checkStorage(): Promise<SystemHealthReport["storage"]> {
  const configuredPath = process.env.THEATREFLOW_STORAGE_PATH;
  if (isManagedHosting() || !configuredPath) {
    return { status: "unknown", source: isManagedHosting() ? "Supabase storage capacity is not measured by this app. View database and file storage usage in the Supabase dashboard; Vercel filesystem usage is unrelated." : "No data volume configured. Set THEATREFLOW_STORAGE_PATH to monitor an on-premises data volume.", total_bytes: null, used_bytes: null, available_bytes: null, utilisation_percent: null };
  }
  try {
    const stats = await statfs(configuredPath);
    const total = stats.blocks * stats.bsize;
    const available = stats.bavail * stats.bsize;
    const used = Math.max(0, total - available);
    const utilisation = total ? Math.round((used / total) * 100) : null;
    const configuredStatus = utilisation === null ? "unknown" : utilisation >= 95 ? "critical" : utilisation >= 85 ? "warning" : "healthy";
    return {
      status: configuredStatus,
      source: "Configured Theatreflow data volume",
      total_bytes: total,
      used_bytes: used,
      available_bytes: available,
      utilisation_percent: utilisation
    };
  } catch {
    return { status: "unknown", source: "Storage path could not be inspected", total_bytes: null, used_bytes: null, available_bytes: null, utilisation_percent: null };
  }
}

async function checkBackup(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["backup"]> {
  if (!supabase) return { status: "unknown", last_success_at: null, age_hours: null };
  const { data, error } = await supabase.from("system_maintenance_events").select("occurred_at").eq("event_type", "backup").eq("status", "success").order("occurred_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data?.occurred_at) return { status: "unknown", last_success_at: null, age_hours: null };
  const elapsed = Date.now() - Date.parse(data.occurred_at);
  if (!Number.isFinite(elapsed) || elapsed < 0) return { status: "unknown", last_success_at: null, age_hours: null };
  const ageHours = Math.floor(elapsed / 3_600_000);
  return { status: ageHours >= 48 ? "critical" : ageHours >= 36 ? "warning" : "healthy", last_success_at: data.occurred_at, age_hours: ageHours };
}

async function checkMigration(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["migration"]> {
  if (!supabase) return { status: "unknown", version: null, name: null, applied_at: null, expected_version: EXPECTED_SCHEMA_VERSION };
  const { data, error } = await supabase.from("theatreflow_schema_migrations").select("version,name,applied_at").order("version", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return { status: "unknown", version: null, name: null, applied_at: null, expected_version: EXPECTED_SCHEMA_VERSION };
  return { status: data.version === EXPECTED_SCHEMA_VERSION ? "healthy" : "warning", version: data.version, name: data.name, applied_at: data.applied_at, expected_version: EXPECTED_SCHEMA_VERSION };
}

async function checkTechnicalActivity(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["activity"]> {
  if (!supabase) return { status: "unknown", open_incidents: null, critical_incidents_24h: null, warnings_24h: null };
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [open, critical, warnings] = await Promise.all([
    supabase.from("system_incidents").select("id", { head: true, count: "exact" }).neq("status", "resolved"),
    supabase.from("system_incidents").select("id", { head: true, count: "exact" }).eq("severity", "critical").gte("occurred_at", since),
    supabase.from("system_incidents").select("id", { head: true, count: "exact" }).eq("severity", "warning").gte("occurred_at", since)
  ]);
  return {
    status: open.error || critical.error || warnings.error || open.count === null || critical.count === null || warnings.count === null ? "unknown" : critical.count > 0 ? "critical" : warnings.count > 0 ? "warning" : "healthy",
    open_incidents: open.error ? null : open.count,
    critical_incidents_24h: critical.error ? null : critical.count,
    warnings_24h: warnings.error ? null : warnings.count
  };
}

function checkCertificate(): SystemHealthReport["certificate"] {
  const expiresAt = process.env.THEATREFLOW_CERTIFICATE_EXPIRES_AT;
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return { status: "unknown", expires_at: null, days_remaining: null };
  const days = Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000);
  return { status: days < 0 ? "critical" : days <= 30 ? "warning" : "healthy", expires_at: new Date(expiresAt).toISOString(), days_remaining: days };
}

function overallStatus(checks: SystemHealthCheck[]): SystemHealthStatus {
  if (checks.some((check) => check.status === "critical")) return "critical";
  if (checks.some((check) => check.status === "warning" || check.status === "unknown")) return "warning";
  return "healthy";
}

function statusSummary(status: SystemHealthStatus, healthy: string, warning: string, critical: string, unknown: string) {
  if (status === "healthy") return healthy;
  if (status === "warning") return warning;
  if (status === "critical") return critical;
  return unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function formatRelativeHours(hours: number | null) {
  if (hours === null) return "at an unknown time";
  if (hours === 0) return "within the last hour";
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}


async function checkConfiguration(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["configuration"]> {
  if (!supabase) return { status: "warning", source: "demo-fallback", active_suites: null, active_theatres: null, legacy_locations: null };
  const [suites, theatres, recovery] = await Promise.all([
    supabase.from("theatre_suites").select("code", { count: "exact" }).eq("active", true),
    supabase.from("theatres").select("id", { head: true, count: "exact" }).eq("active", true),
    supabase.from("recovery_areas").select("id", { head: true, count: "exact" }).eq("active", true)
  ]);
  if (suites.error || theatres.error || recovery.error || !suites.data?.length) return { status: "unknown", source: "unavailable", active_suites: null, active_theatres: null, legacy_locations: null };
  const legacy = suites.data.some(suite => ["st-james", "atkinson-morley", "gynae"].includes(suite.code));
  return { status: legacy ? "warning" : "healthy", source: "database", active_suites: suites.count, active_theatres: theatres.count, legacy_locations: legacy };
}

function safeBuildId() {
  const value = process.env.THEATREFLOW_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA;
  return value && /^[a-f0-9]{7,64}$/i.test(value) ? value : null;
}
