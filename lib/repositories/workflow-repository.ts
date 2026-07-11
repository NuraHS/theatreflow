import { DEFAULT_DELAY_REASONS, DEFAULT_WORKFLOW_STAGES, DEMO_INFRASTRUCTURE_EVENTS } from "@/lib/constants/workflow";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { DelayReason, InfrastructureEvent, Patient, WorkflowEvent, WorkflowStage } from "@/lib/types/domain";
import { getStageByIdOrName } from "@/lib/services/workflow-engine";
import { getDelayStatus } from "@/lib/utils/delay";
import { minutesSince } from "@/lib/utils/time";
import { demoData } from "./demo-data";

export async function getWorkflowStages(): Promise<WorkflowStage[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return DEFAULT_WORKFLOW_STAGES;

  const { data, error } = await supabase.from("workflow_stages").select("*").order("display_order");
  if (error || !data?.length) return DEFAULT_WORKFLOW_STAGES;
  return normaliseCepodStages(data as WorkflowStage[]);
}

export async function getDelayReasons(): Promise<DelayReason[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return DEFAULT_DELAY_REASONS;

  const { data, error } = await supabase.from("delay_reasons").select("*").eq("active", true).order("label");
  if (error || !data?.length) return DEFAULT_DELAY_REASONS;
  return data as DelayReason[];
}

export async function getInfrastructureEvents(): Promise<InfrastructureEvent[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return DEMO_INFRASTRUCTURE_EVENTS;

  const { data, error } = await supabase.from("infrastructure_events").select("*").order("start_time", { ascending: false });
  if (error) return DEMO_INFRASTRUCTURE_EVENTS;
  return data as InfrastructureEvent[];
}

export async function getTodaysPatients() {
  const supabase = createServiceRoleSupabaseClient();
  const stages = await getWorkflowStages();
  const events = supabase ? await getWorkflowEvents() : demoData.events;
  const patients = supabase ? await getPatients() : demoData.patients;

  return patients.map((patient) => {
    const stage = getStageByIdOrName(stages, patient.current_stage) ?? stages[0];
    const patientEvents = events
      .filter((event) => event.patient_id === patient.id)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const lastEvent = patientEvents[0] ?? null;
    const elapsed = minutesSince(lastEvent?.timestamp ?? patient.created_at);

    return {
      ...patient,
      current_stage: stage.id,
      stage,
      last_event: lastEvent,
      elapsed_minutes: elapsed,
      delay_status: getDelayStatus(elapsed, stage.delay_threshold_minutes)
    };
  });
}

export async function getPatients(): Promise<Patient[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return demoData.patients;

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return demoData.patients;
  return data.map((patient) => ({
    ...patient,
    procedure: patient.procedure ?? patient.procedure_name ?? "Not recorded",
    operation_date: patient.operation_date ?? patient.created_at.slice(0, 10)
  })) as Patient[];
}

export async function getWorkflowEvents(): Promise<WorkflowEvent[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return demoData.events;

  const { data, error } = await supabase
    .from("workflow_events")
    .select("*")
    .order("timestamp", { ascending: true });

  if (error || !data) return demoData.events;
  return data as WorkflowEvent[];
}

function normaliseCepodStages(stages: WorkflowStage[]) {
  const withoutDecisionStage = stages.filter((stage) => stage.id !== "decision-to-operate");
  const hasPatientOnList = withoutDecisionStage.some((stage) => stage.id === "patient-on-list");
  const patientOnList = DEFAULT_WORKFLOW_STAGES.find((stage) => stage.id === "patient-on-list");

  return [...(hasPatientOnList || !patientOnList ? [] : [patientOnList]), ...withoutDecisionStage].sort(
    (a, b) => a.display_order - b.display_order
  );
}
