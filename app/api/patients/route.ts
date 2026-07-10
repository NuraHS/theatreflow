import { NextResponse } from "next/server";
import { DEFAULT_WORKFLOW_ID } from "@/lib/constants/workflow";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPatientSchema } from "@/lib/services/schemas";

export async function POST(request: Request) {
  const payload = createPatientSchema.parse(await request.json());
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const created_at = payload.decision_to_operate_time ? new Date(payload.decision_to_operate_time).toISOString() : now;

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      demo: true,
      patient: {
        id: crypto.randomUUID(),
        ...payload,
        created_at,
        current_stage: "decision-to-operate",
        cancelled: false,
        cancellation_reason: null,
        workflow_id: DEFAULT_WORKFLOW_ID
      }
    });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patients")
    .insert({
      hospital_number: payload.hospital_number,
      patient_name: payload.patient_name || null,
      consultant: payload.consultant,
      specialty: payload.specialty,
      procedure: payload.procedure,
      cepod_priority: payload.cepod_priority,
      created_at,
      current_stage: "decision-to-operate",
      cancelled: false,
      cancellation_reason: null,
      workflow_id: DEFAULT_WORKFLOW_ID
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.from("workflow_events").insert({
    patient_id: data.id,
    workflow_stage_id: "decision-to-operate",
    timestamp: created_at,
    user_id: user?.id ?? null,
    user_name: user?.email ?? "Unknown user",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  });

  return NextResponse.json({ ok: true, patient: data });
}
