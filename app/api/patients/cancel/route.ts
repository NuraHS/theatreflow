import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const cancelPatientSchema = z.object({
  patient_id: z.string().min(1),
  reason: z.string().trim().min(3, "Please record why the case was cancelled").max(500)
});

export async function POST(request: Request) {
  const parsed = cancelPatientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Cancellation reason is required" }, { status: 400 });
  }

  const authSupabase = await createServerSupabaseClient();
  const supabase = createServiceRoleSupabaseClient() ?? authSupabase;
  if (!supabase) return NextResponse.json({ ok: true, demo: true });

  const { error } = await supabase.from("patients").update({
    cancelled: true,
    cancellation_reason: parsed.data.reason,
    cancelled_at: new Date().toISOString()
  }).eq("id", parsed.data.patient_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
