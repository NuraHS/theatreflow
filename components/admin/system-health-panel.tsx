"use client";

import * as React from "react";
import { AlertTriangle, Archive, CheckCircle2, Clock3, Database, Download, HardDrive, HeartPulse, RefreshCw, Save, Server, ShieldCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SystemHealthCheck, SystemHealthReport, SystemHealthStatus } from "@/lib/types/system-health";
import { cn } from "@/lib/utils/cn";

export function SystemHealthPanel({ initialReport }: { initialReport: SystemHealthReport }) {
  const [report, setReport] = React.useState(initialReport);
  const [refreshing, setRefreshing] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  const refresh = React.useCallback(async (announce = false) => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/system-health", { cache: "no-store" });
      const result = (await response.json()) as SystemHealthReport & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to refresh system health.");
      setReport(result);
      if (announce) toast.success("System health refreshed.");
    } catch (error) {
      if (announce) toast.error(error instanceof Error ? error.message : "Unable to refresh system health.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const interval = window.setInterval(() => void refresh(false), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function recordSnapshot() {
    setRecording(true);
    const response = await fetch("/api/admin/system-health", { method: "POST" });
    const result = (await response.json()) as { error?: string; report?: SystemHealthReport };
    setRecording(false);
    if (!response.ok) return toast.error(result.error ?? "Unable to record health snapshot.");
    if (result.report) setReport(result.report);
    toast.success("Health snapshot recorded in the local technical audit.");
  }

  async function downloadSupportBundle() {
    setDownloading(true);
    const response = await fetch("/api/admin/support-bundle", { cache: "no-store" });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setDownloading(false);
      return toast.error(result.error ?? "Unable to generate support bundle.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "theatreflow-support.zip";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
    toast.success("Patient-data-free support bundle generated.");
  }

  return (
    <div className="space-y-4">
      <Card className={cn("border-2", statusBorder(report.overall_status))}>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <StatusIcon status={report.overall_status} className="mt-1 h-7 w-7 shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">System {statusLabel(report.overall_status).toLowerCase()}</h2>
                <StatusBadge status={report.overall_status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Checked {formatDateTime(report.generated_at)} · Automatic refresh every 30 seconds · {report.deployment_mode}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={refreshing} onClick={() => void refresh(true)}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
              {refreshing ? "Checking..." : "Refresh"}
            </Button>
            <Button type="button" variant="outline" disabled={recording} onClick={() => void recordSnapshot()}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {recording ? "Recording..." : "Record snapshot"}
            </Button>
            <Button type="button" disabled={downloading} onClick={() => void downloadSupportBundle()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading ? "Generating..." : "Support bundle"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="health-summary-title">
        <h2 id="health-summary-title" className="sr-only">System health summary</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Server} label="Version" value={report.application.version} detail={`Node ${report.application.node_version} · uptime ${formatDuration(report.application.uptime_seconds)}`} />
          <MetricCard icon={Database} label="Database size" value={formatBytes(report.database.size_bytes)} detail={report.database.connection_count === null ? "Connection metrics unavailable" : `${report.database.connection_count} of ${report.database.max_connections ?? "?"} connections`} />
          <MetricCard icon={HardDrive} label="Storage utilisation" value={report.storage.utilisation_percent === null ? "Not available" : `${report.storage.utilisation_percent}%`} detail={`${formatBytes(report.storage.used_bytes)} of ${formatBytes(report.storage.total_bytes)}`} progress={report.storage.utilisation_percent} status={report.storage.status} />
          <MetricCard icon={Archive} label="Last backup" value={report.backup.last_success_at ? formatDateTime(report.backup.last_success_at) : "Not recorded"} detail={report.backup.age_hours === null ? "Record backup events after deployment" : `${report.backup.age_hours} hours ago`} status={report.backup.status} />
          <MetricCard icon={ShieldCheck} label="Last migration" value={report.migration.version ?? "Not recorded"} detail={report.migration.name ?? "Run migration 0009 to enable tracking"} status={report.migration.status} />
          <MetricCard icon={Users} label="Configured users" value={report.authentication.active_users === null ? "Not available" : String(report.authentication.active_users)} detail="No user identities are exported" status={report.authentication.status} />
          <MetricCard icon={AlertTriangle} label="Open incidents" value={String(report.activity.open_incidents)} detail={`${report.activity.critical_incidents_24h} critical · ${report.activity.warnings_24h} warnings in 24h`} status={report.activity.critical_incidents_24h ? "critical" : report.activity.warnings_24h ? "warning" : "healthy"} />
          <MetricCard icon={Clock3} label="Certificate" value={report.certificate.days_remaining === null ? "Not configured" : `${report.certificate.days_remaining} days`} detail={report.certificate.expires_at ? `Expires ${new Date(report.certificate.expires_at).toLocaleDateString("en-GB")}` : "Set the local certificate expiry variable"} status={report.certificate.status} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" aria-hidden="true" />Live component checks</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report.checks.map((check) => <HealthCheckCard key={check.id} check={check} />)}
        </CardContent>
      </Card>

      <Card className="border-cyan-300 bg-cyan-50/60 dark:border-cyan-900 dark:bg-cyan-950/20">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-800 dark:text-cyan-200" aria-hidden="true" />
          <div>
            <h2 className="font-bold">Safe for offline supplier support</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The support bundle contains health checks, redacted technical incidents, maintenance history, version and migration metadata. It never queries patients, procedures, workflow events or the clinical audit log. Trust IT should review the file before sharing it through an approved route.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, progress, status }: { icon: typeof Server; label: string; value: string; detail: string; progress?: number | null; status?: SystemHealthStatus }) {
  return <Card className={cn(status && statusBorder(status))}><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><Icon className="h-5 w-5 text-primary" aria-hidden="true" />{status ? <StatusBadge status={status} /> : null}</div><p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-bold">{value}</p>{progress !== undefined && progress !== null ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className={cn("h-full rounded-full", progress >= 95 ? "bg-red-600" : progress >= 85 ? "bg-amber-500" : "bg-emerald-600")} style={{ width: `${Math.min(100, progress)}%` }} /></div> : null}<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p></CardContent></Card>;
}

function HealthCheckCard({ check }: { check: SystemHealthCheck }) {
  return <article className={cn("rounded-lg border p-4", statusBackground(check.status))}><div className="flex items-start justify-between gap-3"><StatusIcon status={check.status} className="h-5 w-5 shrink-0" /><StatusBadge status={check.status} /></div><h3 className="mt-3 font-bold">{check.label}</h3><p className="mt-1 text-sm font-semibold">{check.summary}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{check.detail}</p></article>;
}

export function StatusBadge({ status }: { status: SystemHealthStatus }) {
  return <Badge tone={status === "healthy" ? "green" : status === "critical" ? "red" : status === "warning" ? "amber" : "blue"}>{statusLabel(status)}</Badge>;
}

export function StatusIcon({ status, className }: { status: SystemHealthStatus; className?: string }) {
  const Icon = status === "healthy" ? CheckCircle2 : status === "critical" ? XCircle : AlertTriangle;
  return <Icon className={cn(status === "healthy" ? "text-emerald-700 dark:text-emerald-300" : status === "critical" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300", className)} aria-hidden="true" />;
}

export function statusLabel(status: SystemHealthStatus) {
  return status === "healthy" ? "Healthy" : status === "critical" ? "Critical" : status === "warning" ? "Warning" : "Unknown";
}

export function formatBytes(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) { current /= 1024; index += 1; }
  return `${current >= 10 || index === 0 ? current.toFixed(0) : current.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days) return `${days}d ${hours}h`;
  const minutes = Math.floor(seconds / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusBorder(status: SystemHealthStatus) {
  return status === "healthy" ? "border-emerald-300 dark:border-emerald-900" : status === "critical" ? "border-red-400 dark:border-red-800" : "border-amber-300 dark:border-amber-900";
}

function statusBackground(status: SystemHealthStatus) {
  return status === "healthy" ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20" : status === "critical" ? "border-red-400 bg-red-50/60 dark:border-red-800 dark:bg-red-950/25" : "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20";
}
