import type { SystemHealthReport, SystemHealthSnapshot, SystemIncident, SystemMaintenanceEvent } from "@/lib/types/system-health";

// Export structured technical fields only. Free text and historical details JSON
// may contain identifiers or secrets; regex redaction cannot guarantee their removal.
const status = (value: unknown) => ["healthy", "warning", "critical", "unknown"].includes(String(value)) ? value : "unknown";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const version = (value: unknown) => typeof value === "string" && /^v?\d+(?:\.\d+){0,3}(?:-[a-z0-9.-]+)?$/i.test(value) ? value : null;
const diagnostic = (value: unknown) => ["credentials", "schema", "paused", "dns", "network", "request"].includes(String(value)) ? value : null;
const oneOf = (value: unknown, allowed: string[]) => allowed.includes(String(value)) ? value : "unknown";

export function supportHealth(report: SystemHealthReport) {
  return {
    generated_at: date(report.generated_at), overall_status: status(report.overall_status),
    deployment_mode: report.deployment_mode === "Cloud hosting / Supabase" ? "cloud" : "local",
    role_permissions_enforced: report.role_permissions_enforced,
    monitoring: { execution: "on-demand", persistent_background_collector: false, automatic_snapshot_recording: false },
    application: { version: version(report.application.version), build_id: report.application.build_id, node_version: version(report.application.node_version), uptime_seconds: number(report.application.uptime_seconds), memory_used_bytes: number(report.application.memory_used_bytes) },
    database: { status: status(report.database.status), diagnostic_code: diagnostic(report.database.diagnostic_code), latency_ms: number(report.database.latency_ms), size_bytes: number(report.database.size_bytes), connection_count: number(report.database.connection_count), max_connections: number(report.database.max_connections) },
    storage: { status: status(report.storage.status), total_bytes: number(report.storage.total_bytes), used_bytes: number(report.storage.used_bytes), available_bytes: number(report.storage.available_bytes), utilisation_percent: number(report.storage.utilisation_percent) },
    authentication: { status: status(report.authentication.status), diagnostic_code: diagnostic(report.authentication.diagnostic_code), configured_profiles: number(report.authentication.active_users) },
    backup: { status: status(report.backup.status), last_recorded_success_at: date(report.backup.last_success_at), age_hours: number(report.backup.age_hours), restore_verified: false },
    migration: { status: status(report.migration.status), version: version(report.migration.version), expected_version: version(report.migration.expected_version), applied_at: date(report.migration.applied_at), schema_verified: false },
    certificate: { status: status(report.certificate.status), expires_at: date(report.certificate.expires_at), days_remaining: report.certificate.days_remaining },
    configuration: { status: status(report.configuration.status), source: oneOf(report.configuration.source, ["database", "demo-fallback", "unavailable"]), active_suites: number(report.configuration.active_suites), active_theatres: number(report.configuration.active_theatres), legacy_locations: report.configuration.legacy_locations },
    activity: { status: status(report.activity.status), open_incidents: number(report.activity.open_incidents), critical_incidents_24h: number(report.activity.critical_incidents_24h), warnings_24h: number(report.activity.warnings_24h) },
    checks: report.checks.map(check => ({ id: check.id, status: status(check.status), latency_ms: number(check.latency_ms) }))
  };
}

export function supportIncidents(incidents: SystemIncident[]) {
  return incidents.map(item => ({
    occurred_at: date(item.occurred_at), recorded_at: date(item.recorded_at), resolved_at: date(item.resolved_at),
    component: oneOf(item.component, ["application", "database", "authentication", "storage", "backup", "network", "certificate", "update", "other"]),
    severity: oneOf(item.severity, ["info", "warning", "critical"]), status: oneOf(item.status, ["open", "monitoring", "resolved"])
  }));
}

export function supportHistory(snapshots: SystemHealthSnapshot[]) {
  return snapshots.map(item => ({
    checked_at: date(item.checked_at), overall_status: status(item.overall_status), application_status: status(item.application_status),
    database_status: status(item.database_status), authentication_status: status(item.authentication_status), storage_status: status(item.storage_status),
    database_size_bytes: number(item.database_size_bytes), storage_total_bytes: number(item.storage_total_bytes), storage_used_bytes: number(item.storage_used_bytes), app_version: version(item.app_version)
    // Old count columns could mean either zero or a failed read. Omit these from
    // historical exports; current health.json explicitly preserves unknown counts.
  }));
}

export function supportMaintenance(events: SystemMaintenanceEvent[]) {
  return events.map(item => ({ event_type: oneOf(item.event_type, ["backup", "restore", "migration", "update", "certificate", "maintenance"]), status: oneOf(item.status, ["success", "warning", "failed"]), occurred_at: date(item.occurred_at), version: version(item.version) }));
}

export function supportMigrations(events: Array<{ version: string; name: string; applied_at: string }>) {
  return events.map(item => ({ version: version(item.version), applied_at: date(item.applied_at) }));
}
