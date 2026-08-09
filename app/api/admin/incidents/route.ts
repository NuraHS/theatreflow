import { NextResponse } from "next/server";
import { z } from "zod";
import { createSystemIncident, getSystemIncidents, updateSystemIncident } from "@/lib/repositories/system-repository";
import { hasPermission } from "@/lib/services/access-control";

const componentValues = ["application", "database", "authentication", "storage", "backup", "network", "certificate", "update", "other"] as const;
const createIncidentSchema = z.object({
  occurred_at: z.string().datetime(),
  component: z.enum(componentValues),
  severity: z.enum(["info", "warning", "critical"]),
  summary: z.string().trim().min(3).max(200),
  details: z.string().trim().max(4000).optional()
});
const updateIncidentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "monitoring", "resolved"]),
  resolution_notes: z.string().trim().max(4000).optional()
});

export async function GET() {
  if (!(await hasPermission("viewSystemDiagnostics"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  return NextResponse.json({ incidents: await getSystemIncidents() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await hasPermission("viewSystemDiagnostics"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = createIncidentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid incident." }, { status: 400 });
  const result = await createSystemIncident(parsed.data);
  if (result.error) {
    const hint = result.error.includes("system_incidents") ? " Run migration 0009_system_health_monitoring.sql first." : "";
    return NextResponse.json({ error: `${result.error}${hint}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, incident: result.data });
}

export async function PATCH(request: Request) {
  if (!(await hasPermission("viewSystemDiagnostics"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = updateIncidentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid incident update." }, { status: 400 });
  const result = await updateSystemIncident(parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, incident: result.data });
}
