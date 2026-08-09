import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { advanceWorkflowSchema } from "@/lib/services/schemas";
import { activeInfrastructureEventIds, getNextStage, getStageByIdOrName } from "@/lib/services/workflow-engine";
import { getInfrastructureEvents, getWorkflowStages } from "@/lib/repositories/workflow-repository";

export async function POST(request: Request) {
  const payload = advanceWorkflowSchema.parse(await request.json());
  const authSupabase = await createServerSupabaseClient();
  const supabase = createServiceRoleSupabaseClient() ?? authSupabase;
  const stages = await getWorkflowStages();
  const currentStage = getStageByIdOrName(stages, payload.current_stage_id);
  const nextStage = currentStage ? getNextStage(stages, currentStage.id) : null;

  if (!currentStage) {
    return NextResponse.json({ error: "Current workflow stage could not be matched." }, { status: 400 });
  }

  if (!nextStage) {
    return NextResponse.json({ error: "Patient is already at the final workflow stage." }, { status: 400 });
  }

  const timestamp = new Date();
  const infrastructure_event_ids = activeInfrastructureEventIds(await getInfrastructureEvents(), timestamp);

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      demo: true,
      next_stage: nextStage,
      timestamp: timestamp.toISOString(),
      infrastructure_event_ids
    });
  }

  const {
    data: { user }
  } = authSupabase ? await authSupabase.auth.getUser() : { data: { user: null } };

  const patientUpdate = nextStage.id === "patient-out-of-recovery"
    ? {
        current_stage: nextStage.id,
        completed_at: timestamp.toISOString(),
        unresolved: false,
        unresolved_at: null,
        unresolved_from_stage: null,
        reconciliation_reviewed_at: null
      }
    : {
        current_stage: nextStage.id,
        unresolved: false,
        unresolved_at: null,
        unresolved_from_stage: null,
        reconciliation_reviewed_at: null
      };
  let { error: patientError } = await supabase
    .from("patients")
    .update(patientUpdate)
    .eq("id", payload.patient_id);

  if (patientError && isReconciliationSchemaError(patientError.message)) {
    const legacyUpdate = nextStage.id === "patient-out-of-recovery"
      ? { current_stage: nextStage.id, completed_at: timestamp.toISOString() }
      : { current_stage: nextStage.id };
    const retry = await supabase.from("patients").update(legacyUpdate).eq("id", payload.patient_id);
    patientError = retry.error;
  }

  if (patientError) {
    return NextResponse.json({ error: patientError.message }, { status: 400 });
  }

  const { error: eventError } = await supabase.from("workflow_events").insert({
    patient_id: payload.patient_id,
    workflow_stage_id: nextStage.id,
    timestamp: timestamp.toISOString(),
    user_id: user?.id ?? null,
    user_name: user?.email ?? "Unknown user",
    delay_reason_ids: payload.delay_reason_ids,
    delay_comments: payload.delay_comments || null,
    infrastructure_event_ids
  });

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, next_stage: nextStage, timestamp: timestamp.toISOString() });
}

function isReconciliationSchemaError(message: string) {
  return ["unresolved", "unresolved_at", "unresolved_from_stage", "reconciliation_reviewed_at"].some((column) => message.includes(column));
}
