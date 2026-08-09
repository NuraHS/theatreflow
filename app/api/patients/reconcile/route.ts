import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canAccessPatient, hasPermission } from "@/lib/services/access-control";

const reconcilePatientSchema = z.object({
  patient_id: z.string().min(1),
  action: z.literal("keep_active")
});

export async function PATCH(request: Request) {
  const parsed = reconcilePatientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid reconciliation action is required." }, { status: 400 });
  }
  if (!(await hasPermission("advanceWorkflow"))) return NextResponse.json({ error: "Your role cannot reconcile patients." }, { status: 403 });
  if (!(await canAccessPatient(parsed.data.patient_id))) return NextResponse.json({ error: "You do not have access to this patient's theatre." }, { status: 403 });

  const authSupabase = await createServerSupabaseClient();
  const supabase = createServiceRoleSupabaseClient() ?? authSupabase;
  const reviewedAt = new Date().toISOString();

  if (!supabase) return NextResponse.json({ ok: true, demo: true, reviewed_at: reviewedAt });

  const { error } = await supabase
    .from("patients")
    .update({
      unresolved: false,
      unresolved_at: null,
      unresolved_from_stage: null,
      reconciliation_reviewed_at: reviewedAt
    })
    .eq("id", parsed.data.patient_id);

  if (error) {
    const schemaHint = error.message.includes("schema cache") || error.message.includes("unresolved")
      ? " Run migration 0008_add_unresolved_reconciliation.sql in Supabase, then retry."
      : "";
    return NextResponse.json({ error: `${error.message}${schemaHint}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, reviewed_at: reviewedAt });
}
