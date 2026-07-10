import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { advanceWorkflowSchema } from "@/lib/services/schemas";
import { activeInfrastructureEventIds, getNextStage } from "@/lib/services/workflow-engine";
import { getInfrastructureEvents, getWorkflowStages } from "@/lib/repositories/workflow-repository";

export async function POST(request: Request) {
  const payload = advanceWorkflowSchema.parse(await request.json());
  const supabase = await createServerSupabaseClient();
  const stages = await getWorkflowStages();
  const nextStage = getNextStage(stages, payload.current_stage_id);

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
  } = await supabase.auth.getUser();

  const { error: patientError } = await supabase
    .from("patients")
    .update({ current_stage: nextStage.id })
    .eq("id", payload.patient_id);

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
