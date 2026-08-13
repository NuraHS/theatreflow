import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { amendStageStartedSchema } from "@/lib/services/schemas";
import { canAccessPatient, hasPermission } from "@/lib/services/access-control";

export async function PATCH(request: Request) {
  const payload = amendStageStartedSchema.parse(await request.json());
  if (!(await hasPermission("advanceWorkflow"))) {
    return NextResponse.json({ error: "Your role cannot amend workflow timestamps." }, { status: 403 });
  }
  if (!(await canAccessPatient(payload.patient_id))) {
    return NextResponse.json({ error: "You do not have access to this patient's theatre." }, { status: 403 });
  }

  const amendedTime = new Date(payload.stage_started_at);
  const now = new Date();
  if (Number.isNaN(amendedTime.getTime())) {
    return NextResponse.json({ error: "The stage start time is invalid." }, { status: 400 });
  }
  if (amendedTime.getTime() > now.getTime() + 60_000) {
    return NextResponse.json({ error: "The stage start time cannot be in the future." }, { status: 400 });
  }

  const authSupabase = await createServerSupabaseClient();
  const supabase = createServiceRoleSupabaseClient() ?? authSupabase;
  if (!supabase) return NextResponse.json({ ok: true, demo: true, timestamp: amendedTime.toISOString() });

  const { data: events, error: eventsError } = await supabase
    .from("workflow_events")
    .select("id,workflow_stage_id,timestamp")
    .eq("patient_id", payload.patient_id)
    .order("timestamp", { ascending: true });
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 400 });

  const currentIndex = (events ?? []).findIndex((event) => event.id === payload.event_id);
  if (currentIndex === -1) return NextResponse.json({ error: "The workflow timestamp could not be found." }, { status: 404 });
  if (currentIndex !== (events?.length ?? 0) - 1) {
    return NextResponse.json({ error: "Only the current stage start time can be amended here." }, { status: 400 });
  }
  const previousEvent = currentIndex > 0 ? events?.[currentIndex - 1] : null;
  if (previousEvent?.timestamp && amendedTime.getTime() < Date.parse(previousEvent.timestamp)) {
    return NextResponse.json({ error: "The stage cannot start before the preceding workflow stage." }, { status: 400 });
  }

  const currentEvent = events?.[currentIndex];
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("current_stage")
    .eq("id", payload.patient_id)
    .maybeSingle();
  if (patientError) return NextResponse.json({ error: patientError.message }, { status: 400 });
  if (!patient || patient.current_stage !== currentEvent?.workflow_stage_id) {
    return NextResponse.json({ error: "The selected timestamp is not for the patient's current stage." }, { status: 400 });
  }

  const { error } = await supabase
    .from("workflow_events")
    .update({ timestamp: amendedTime.toISOString() })
    .eq("id", payload.event_id)
    .eq("patient_id", payload.patient_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (currentEvent.workflow_stage_id === "patient-out-of-recovery") {
    const { error: completionError } = await supabase
      .from("patients")
      .update({ completed_at: amendedTime.toISOString() })
      .eq("id", payload.patient_id);
    if (completionError) return NextResponse.json({ error: completionError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, timestamp: amendedTime.toISOString() });
}
