"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ClipboardPlus, Clock3, FileClock, RefreshCw, Save, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, StatusBadge, StatusIcon } from "@/components/admin/system-health-panel";
import type { SystemHealthReport, SystemHealthSnapshot, SystemIncident } from "@/lib/types/system-health";

const componentLabels: Record<SystemIncident["component"], string> = {
  application: "Application",
  database: "Database",
  authentication: "Authentication",
  storage: "Storage",
  backup: "Backup",
  network: "Internal network",
  certificate: "Certificate",
  update: "Update / migration",
  other: "Other"
};

export function SystemDiagnosticsPanel({ initialReport, initialIncidents, initialSnapshots }: { initialReport: SystemHealthReport; initialIncidents: SystemIncident[]; initialSnapshots: SystemHealthSnapshot[] }) {
  const [report, setReport] = React.useState(initialReport);
  const [incidents, setIncidents] = React.useState(initialIncidents);
  const [snapshots, setSnapshots] = React.useState(initialSnapshots);
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [component, setComponent] = React.useState<SystemIncident["component"]>("application");
  const [severity, setSeverity] = React.useState<SystemIncident["severity"]>("warning");
  const [occurredAt, setOccurredAt] = React.useState(toLocalDateTime(new Date()));
  const [summary, setSummary] = React.useState("");
  const [details, setDetails] = React.useState("");

  const refresh = React.useCallback(async (announce = false) => {
    setRefreshing(true);
    try {
      const [healthResponse, incidentsResponse] = await Promise.all([
        fetch("/api/admin/system-health", { cache: "no-store" }),
        fetch("/api/admin/incidents", { cache: "no-store" })
      ]);
      const healthResult = (await healthResponse.json()) as SystemHealthReport & { error?: string };
      const incidentResult = (await incidentsResponse.json()) as { incidents?: SystemIncident[]; error?: string };
      if (!healthResponse.ok) throw new Error(healthResult.error ?? "Unable to refresh diagnostics.");
      if (!incidentsResponse.ok) throw new Error(incidentResult.error ?? "Unable to refresh incidents.");
      setReport(healthResult);
      setIncidents(incidentResult.incidents ?? []);
      if (announce) toast.success("Diagnostics refreshed.");
    } catch (error) {
      if (announce) toast.error(error instanceof Error ? error.message : "Unable to refresh diagnostics.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const interval = window.setInterval(() => void refresh(false), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function createIncident(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const response = await fetch("/api/admin/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occurred_at: new Date(occurredAt).toISOString(),
        component,
        severity,
        summary,
        details
      })
    });
    const result = (await response.json()) as { incident?: SystemIncident; error?: string };
    setSubmitting(false);
    if (!response.ok || !result.incident) return toast.error(result.error ?? "Unable to record incident.");
    setIncidents((current) => [result.incident!, ...current]);
    setSummary("");
    setDetails("");
    setOccurredAt(toLocalDateTime(new Date()));
    toast.success("Technical incident recorded locally.");
  }

  async function updateIncident(id: string, status: SystemIncident["status"], resolutionNotes: string) {
    const response = await fetch("/api/admin/incidents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, resolution_notes: resolutionNotes })
    });
    const result = (await response.json()) as { incident?: SystemIncident; error?: string };
    if (!response.ok || !result.incident) {
      toast.error(result.error ?? "Unable to update incident.");
      return;
    }
    setIncidents((current) => current.map((incident) => incident.id === id ? result.incident! : incident));
    toast.success(status === "resolved" ? "Incident marked resolved." : "Incident status updated.");
  }

  async function recordSnapshot() {
    const response = await fetch("/api/admin/system-health", { method: "POST" });
    const result = (await response.json()) as { snapshot?: SystemHealthSnapshot; report?: SystemHealthReport; error?: string };
    if (!response.ok || !result.snapshot) return toast.error(result.error ?? "Unable to record snapshot.");
    setSnapshots((current) => [result.snapshot!, ...current]);
    if (result.report) setReport(result.report);
    toast.success("Diagnostic snapshot added to the history.");
  }

  return <div className="space-y-4">
    <Card>
      <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />Live fault isolation</CardTitle><p className="mt-1 text-sm text-muted-foreground">Each component is checked separately so local IT can see where a failure originates.</p></div><Button type="button" variant="outline" disabled={refreshing} onClick={() => void refresh(true)}><RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />{refreshing ? "Checking..." : "Refresh"}</Button></div></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report.checks.map((check) => <article key={check.id} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><StatusIcon status={check.status} className="h-5 w-5" /><StatusBadge status={check.status} /></div><h3 className="mt-3 font-bold">{check.label}</h3><p className="mt-1 text-sm font-semibold">{check.summary}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{check.detail}</p></article>)}
      </CardContent>
    </Card>

    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardPlus className="h-5 w-5 text-primary" aria-hidden="true" />Record a technical incident</CardTitle><p className="text-sm leading-relaxed text-muted-foreground">Use technical descriptions only. Do not enter patient names, hospital/NHS numbers, dates of birth, procedures or clinical notes.</p></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void createIncident(event)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Component"><Select value={component} onChange={(event) => setComponent(event.target.value as SystemIncident["component"])}>{Object.entries(componentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
              <Field label="Severity"><Select value={severity} onChange={(event) => setSeverity(event.target.value as SystemIncident["severity"])}><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></Select></Field>
            </div>
            <Field label="When it occurred"><Input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></Field>
            <Field label="Technical summary"><Input value={summary} onChange={(event) => setSummary(event.target.value)} minLength={3} maxLength={200} placeholder="For example: Database health check failed after VM restart" required /></Field>
            <Field label="Technical details"><Textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={4000} placeholder="Error code, affected component, local infrastructure change and reproduction steps. No patient data." /></Field>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>Incident text may be included in a supplier support bundle. Keep it strictly technical and patient-data-free.</p></div></div>
            <Button type="submit" disabled={submitting || summary.trim().length < 3} className="w-full"><Save className="h-4 w-4" aria-hidden="true" />{submitting ? "Recording..." : "Record incident"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5 text-primary" aria-hidden="true" />Technical incident history</CardTitle><p className="text-sm text-muted-foreground">{incidents.length} recorded incident{incidents.length === 1 ? "" : "s"}; clinical audit events remain separate.</p></CardHeader>
        <CardContent className="space-y-3">
          {incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} onUpdate={updateIncident} />)}
          {!incidents.length ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No technical incidents have been recorded.</div> : null}
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" aria-hidden="true" />Health audit history</CardTitle><p className="mt-1 text-sm text-muted-foreground">Time-stamped snapshots show how system health changed before and after incidents or updates.</p></div><Button type="button" variant="outline" onClick={() => void recordSnapshot()}><Save className="h-4 w-4" aria-hidden="true" />Record current snapshot</Button></div></CardHeader>
      <CardContent><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted"><tr><th className="px-3 py-3 text-left">Checked</th><th className="px-3 py-3 text-left">Overall</th><th className="px-3 py-3 text-left">Application</th><th className="px-3 py-3 text-left">Database</th><th className="px-3 py-3 text-left">Authentication</th><th className="px-3 py-3 text-left">Storage</th><th className="px-3 py-3 text-left">Database size</th><th className="px-3 py-3 text-left">Version</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={snapshot.id} className="border-t"><td className="whitespace-nowrap px-3 py-3">{formatDateTime(snapshot.checked_at)}</td><td className="px-3 py-3"><StatusBadge status={snapshot.overall_status} /></td><td className="px-3 py-3"><StatusBadge status={snapshot.application_status} /></td><td className="px-3 py-3"><StatusBadge status={snapshot.database_status} /></td><td className="px-3 py-3"><StatusBadge status={snapshot.authentication_status} /></td><td className="px-3 py-3"><StatusBadge status={snapshot.storage_status} /></td><td className="whitespace-nowrap px-3 py-3">{formatBytes(snapshot.database_size_bytes)}</td><td className="px-3 py-3">{snapshot.app_version}</td></tr>)}</tbody></table>{!snapshots.length ? <div className="p-8 text-center text-sm text-muted-foreground">No health snapshots recorded yet.</div> : null}</div></CardContent>
    </Card>
  </div>;
}

function IncidentCard({ incident, onUpdate }: { incident: SystemIncident; onUpdate: (id: string, status: SystemIncident["status"], notes: string) => Promise<void> }) {
  const [notes, setNotes] = React.useState(incident.resolution_notes ?? "");
  const [updating, setUpdating] = React.useState(false);
  async function update(status: SystemIncident["status"]) { setUpdating(true); await onUpdate(incident.id, status, notes); setUpdating(false); }
  return <article className="rounded-lg border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={incident.severity === "critical" ? "red" : incident.severity === "warning" ? "amber" : "blue"}>{incident.severity}</Badge><Badge tone={incident.status === "resolved" ? "green" : "amber"}>{incident.status}</Badge><span className="text-sm font-semibold text-muted-foreground">{componentLabels[incident.component]}</span></div><h3 className="mt-2 font-bold">{incident.summary}</h3><p className="mt-1 text-sm text-muted-foreground">Occurred {formatDateTime(incident.occurred_at)}</p>{incident.details ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{incident.details}</p> : null}</div>{incident.status === "resolved" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : null}</div>{incident.status !== "resolved" ? <div className="mt-4 border-t pt-4"><Label htmlFor={`resolution-${incident.id}`}>Resolution / monitoring notes</Label><Textarea id={`resolution-${incident.id}`} className="mt-2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Technical action taken; no patient data." /><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={updating} onClick={() => void update("monitoring")}>Mark monitoring</Button><Button type="button" disabled={updating || notes.trim().length < 3} onClick={() => void update("resolved")}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Mark resolved</Button></div></div> : incident.resolution_notes ? <div className="mt-3 rounded-md bg-muted p-3 text-sm"><strong>Resolution:</strong> {incident.resolution_notes}</div> : null}</article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold">{label}<span className="mt-1 block">{children}</span></label>; }
function toLocalDateTime(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
