export type SystemHealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type SystemHealthCheck = {
  id: "application" | "database" | "authentication" | "storage" | "backup" | "migration" | "certificate";
  label: string;
  status: SystemHealthStatus;
  summary: string;
  detail: string;
  latency_ms?: number | null;
};

export type SystemHealthReport = {
  generated_at: string;
  overall_status: SystemHealthStatus;
  deployment_mode: string;
  application: {
    version: string;
    node_version: string;
    uptime_seconds: number;
    memory_used_bytes: number;
  };
  database: {
    status: SystemHealthStatus;
    latency_ms: number | null;
    size_bytes: number | null;
    connection_count: number | null;
    max_connections: number | null;
  };
  storage: {
    status: SystemHealthStatus;
    source: string;
    total_bytes: number | null;
    used_bytes: number | null;
    available_bytes: number | null;
    utilisation_percent: number | null;
  };
  authentication: {
    status: SystemHealthStatus;
    active_users: number | null;
  };
  backup: {
    status: SystemHealthStatus;
    last_success_at: string | null;
    age_hours: number | null;
  };
  migration: {
    status: SystemHealthStatus;
    version: string | null;
    name: string | null;
    applied_at: string | null;
  };
  certificate: {
    status: SystemHealthStatus;
    expires_at: string | null;
    days_remaining: number | null;
  };
  activity: {
    open_incidents: number;
    critical_incidents_24h: number;
    warnings_24h: number;
  };
  checks: SystemHealthCheck[];
};

export type SystemIncident = {
  id: string;
  occurred_at: string;
  recorded_at: string;
  component: "application" | "database" | "authentication" | "storage" | "backup" | "network" | "certificate" | "update" | "other";
  severity: "info" | "warning" | "critical";
  status: "open" | "monitoring" | "resolved";
  summary: string;
  details: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  recorded_by: string | null;
};

export type SystemHealthSnapshot = {
  id: string;
  checked_at: string;
  overall_status: SystemHealthStatus;
  application_status: SystemHealthStatus;
  database_status: SystemHealthStatus;
  authentication_status: SystemHealthStatus;
  storage_status: SystemHealthStatus;
  database_size_bytes: number | null;
  storage_total_bytes: number | null;
  storage_used_bytes: number | null;
  app_version: string;
  critical_incidents_24h: number;
  warnings_24h: number;
  details: Record<string, unknown>;
};

export type SystemMaintenanceEvent = {
  id: string;
  event_type: "backup" | "restore" | "migration" | "update" | "certificate" | "maintenance";
  status: "success" | "warning" | "failed";
  occurred_at: string;
  version: string | null;
  notes: string | null;
  recorded_by: string | null;
};
