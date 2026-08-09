import { NextResponse } from "next/server";
import { recordSystemHealthSnapshot } from "@/lib/repositories/system-repository";
import { hasPermission } from "@/lib/services/access-control";
import { getSystemHealthReport } from "@/lib/services/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasPermission("viewSystemHealth"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  return NextResponse.json(await getSystemHealthReport(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  if (!(await hasPermission("viewSystemHealth"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const report = await getSystemHealthReport();
  const result = await recordSystemHealthSnapshot(report);
  if (result.error) {
    const hint = result.error.includes("system_health_snapshots") ? " Run migration 0009_system_health_monitoring.sql first." : "";
    return NextResponse.json({ error: `${result.error}${hint}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, snapshot: result.data, report });
}
