import { NextResponse } from "next/server";
import { getSystemHealthReport, publicHealthReport } from "@/lib/services/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getSystemHealthReport();
  const status = report.overall_status === "critical" ? 503 : 200;
  return NextResponse.json(publicHealthReport(report), {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
