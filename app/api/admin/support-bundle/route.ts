import JSZip from "jszip";
import { NextResponse } from "next/server";
import {
  getKnownSchemaMigrations,
  getSystemHealthSnapshots,
  getSystemIncidents,
  getSystemMaintenanceEvents
} from "@/lib/repositories/system-repository";
import { hasPermission, isRolePermissionEnforced } from "@/lib/services/access-control";
import { getSystemHealthReport } from "@/lib/services/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasPermission("viewSystemDiagnostics"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const [health, incidents, snapshots, maintenance, migrations] = await Promise.all([
    getSystemHealthReport(),
    getSystemIncidents(500),
    getSystemHealthSnapshots(500),
    getSystemMaintenanceEvents(500),
    getKnownSchemaMigrations()
  ]);
  const generatedAt = new Date();
  const zip = new JSZip();
  const safeIncidents = incidents.map((incident) => ({
    ...incident,
    summary: redactTechnicalText(incident.summary),
    details: redactTechnicalText(incident.details),
    resolution_notes: redactTechnicalText(incident.resolution_notes),
    recorded_by: incident.recorded_by ? "local-user-redacted" : null
  }));

  zip.file("README.txt", [
    "Theatreflow patient-data-free support bundle",
    "",
    "This bundle was generated inside the Trust boundary and contains only system health, technical incident, maintenance and migration metadata.",
    "It does not query or export patients, workflow events, procedures, hospital numbers or the clinical audit log.",
    "Free-text technical incident fields are automatically redacted for common patient identifiers. Trust IT should still review this bundle before release through an approved support route.",
    "",
    `Generated: ${generatedAt.toISOString()}`
  ].join("\n"));
  zip.file("manifest.json", json({
    bundle_format: "theatreflow-support-bundle-v1",
    generated_at: generatedAt.toISOString(),
    patient_data_included: false,
    files: ["health.json", "technical-incidents.json", "health-history.json", "maintenance-history.json", "migration-status.json", "safe-configuration.json"]
  }));
  zip.file("health.json", json(health));
  zip.file("technical-incidents.json", json(safeIncidents));
  zip.file("health-history.json", json(snapshots));
  zip.file("maintenance-history.json", json(maintenance.map((event) => ({ ...event, recorded_by: event.recorded_by ? "local-user-redacted" : null, notes: redactTechnicalText(event.notes) }))));
  zip.file("migration-status.json", json(migrations));
  zip.file("safe-configuration.json", json({
    deployment_mode: health.deployment_mode,
    node_environment: process.env.NODE_ENV,
    database_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    storage_path_configured: Boolean(process.env.THEATREFLOW_STORAGE_PATH),
    certificate_expiry_configured: Boolean(process.env.THEATREFLOW_CERTIFICATE_EXPIRES_AT),
    role_permissions_enforced: isRolePermissionEnforced(),
    outbound_telemetry_enabled: false
  }));

  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const responseBody = new Uint8Array(archive).buffer as ArrayBuffer;
  const date = generatedAt.toISOString().slice(0, 10);
  return new NextResponse(responseBody, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="theatreflow-support-${date}.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function redactTechnicalText(value: string | null) {
  if (!value) return value;
  return value
    .replace(/\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g, "[REDACTED IDENTIFIER]")
    .replace(/\b[A-Z]\d{6,10}\b/gi, "[REDACTED HOSPITAL IDENTIFIER]")
    .replace(/\b(patient[_ ]?name|nhs[_ ]?number|hospital[_ ]?number|date[_ ]?of[_ ]?birth|dob)\s*[:=]\s*[^,;\n]+/gi, "$1=[REDACTED]");
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}
