import "server-only";

import { statfs } from "node:fs/promises";
import { connectionFailure, isManagedHosting } from "@/lib/services/health-diagnostics";
import packageJson from "@/package.json";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { SystemHealthCheck, SystemHealthReport, SystemHealthStatus } from "@/lib/types/system-health";

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const generatedAt = new Date().toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const [database, authentication, storage, backup, migration, activity, certificate] = await Promise.all([
    checkDatabase(supabase),
    checkAuthentication(supabase),
    checkStorage(),
    checkBackup(supabase),
    checkMigration(supabase),
    checkTechnicalActivity(supabase),
    checkCertificate()
  ]);

  const checks: SystemHealthCheck[] = [
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
      detail: database.detail ?? (database.latency_ms === null ? "Configure the Supabase project URL and server-side service-role key in Vercel." : `Query completed in ${database.latency_ms} ms.`),
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
      detail: migration.applied_at ? `Applied ${new Date(migration.applied_at).toLocaleString("en-GB")}.` : "Run the latest Theatreflow migration to enable tracking."
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
    application: {
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
  const ageHours = Math.max(0, Math.round((Date.now() - Date.parse(data.occurred_at)) / 3_600_000));
  return { status: ageHours >= 48 ? "critical" : ageHours >= 36 ? "warning" : "healthy", last_success_at: data.occurred_at, age_hours: ageHours };
}

async function checkMigration(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["migration"]> {
  if (!supabase) return { status: "unknown", version: null, name: null, applied_at: null };
  const { data, error } = await supabase.from("theatreflow_schema_migrations").select("version,name,applied_at").order("version", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return { status: "unknown", version: null, name: null, applied_at: null };
  return { status: "healthy", version: data.version, name: data.name, applied_at: data.applied_at };
}

async function checkTechnicalActivity(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<SystemHealthReport["activity"]> {
  if (!supabase) return { open_incidents: 0, critical_incidents_24h: 0, warnings_24h: 0 };
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [open, critical, warnings] = await Promise.all([
    supabase.from("system_incidents").select("id", { head: true, count: "exact" }).neq("status", "resolved"),
    supabase.from("system_incidents").select("id", { head: true, count: "exact" }).eq("severity", "critical").gte("occurred_at", since),
    supabase.from("system_incidents").select("id", { head: true, count: "exact" }).eq("severity", "warning").gte("occurred_at", since)
  ]);
  return {
    open_incidents: open.error ? 0 : open.count ?? 0,
    critical_incidents_24h: critical.error ? 0 : critical.count ?? 0,
    warnings_24h: warnings.error ? 0 : warnings.count ?? 0
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
