import { DEFAULT_DELAY_REASONS, DEFAULT_WORKFLOW_STAGES, DEMO_INFRASTRUCTURE_EVENTS } from "@/lib/constants/workflow";
import { DEFAULT_THEATRE_CONFIGURATION } from "@/lib/constants/theatre-locations";
import { getTheatreConfiguration } from "@/lib/repositories/theatre-repository";
import { getCurrentUserAccess, isRolePermissionEnforced } from "@/lib/services/access-control";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { DelayReason, InfrastructureEvent, Patient, PatientListMovement, WorkflowEvent, WorkflowStage } from "@/lib/types/domain";
import { getStageByIdOrName } from "@/lib/services/workflow-engine";
import { getDelayStatus } from "@/lib/utils/delay";
import { getReconciliationDueAt, getReconciliationReferenceTime, getUnresolvedThresholdMinutes } from "@/lib/utils/reconciliation";
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

  const now = new Date();
  const enrichedPatients = patients.map((patient) => {
    const stage = getStageByIdOrName(stages, patient.current_stage) ?? stages[0];
    const patientEvents = events
      .filter((event) => event.patient_id === patient.id)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const lastEvent = patientEvents[0] ?? null;
    const elapsed = minutesSince(lastEvent?.timestamp ?? patient.created_at);
    const stageStartedAt = lastEvent?.timestamp ?? patient.created_at;
    const reconciliationReference = getReconciliationReferenceTime({
      stageStartedAt,
      reviewedAt: patient.reconciliation_reviewed_at
    });
    const unresolvedThreshold = getUnresolvedThresholdMinutes(stage.id);
    const reconciliationDueAt = getReconciliationDueAt(stage.id, reconciliationReference);
    const shouldBeUnresolved = Boolean(
      !patient.cancelled &&
      stage.id !== "patient-out-of-recovery" &&
      reconciliationDueAt &&
      Date.parse(reconciliationDueAt) <= now.getTime()
    );
    const storedUnresolvedForStage = patient.unresolved && (!patient.unresolved_from_stage || patient.unresolved_from_stage === stage.id);
    const unresolved = storedUnresolvedForStage || shouldBeUnresolved;

    return {
      ...patient,
      current_stage: stage.id,
      unresolved,
      unresolved_at: unresolved ? patient.unresolved_at ?? reconciliationDueAt : null,
      unresolved_from_stage: unresolved ? patient.unresolved_from_stage ?? stage.id : null,
      stage,
      last_event: lastEvent,
      elapsed_minutes: elapsed,
      delay_status: getDelayStatus(elapsed, stage.delay_threshold_minutes),
      unresolved_threshold_minutes: unresolvedThreshold,
      reconciliation_due_at: reconciliationDueAt
    };
  });

  if (supabase) {
    const newlyUnresolved = enrichedPatients.filter((patient) => {
      const stored = patients.find((item) => item.id === patient.id);
      return patient.unresolved && !stored?.unresolved;
    });

    await Promise.all(
      newlyUnresolved.map((patient) =>
        supabase
          .from("patients")
          .update({
            unresolved: true,
            unresolved_at: patient.unresolved_at ?? now.toISOString(),
            unresolved_from_stage: patient.current_stage
          })
          .eq("id", patient.id)
      )
    );
  }

  return scopePatientsForCurrentUser(enrichedPatients);
}

export async function getActivePatients() {
  const patients = await getTodaysPatients();
  const now = new Date();
  const today = localDateKey(now);
  const afterSeven = now.getHours() >= 7;

  return patients.filter((patient) => {
    if (patient.cancelled) return false;
    if (patient.current_stage !== "patient-out-of-recovery") return true;
    const completedDate = (patient.completed_at ?? patient.last_event?.timestamp ?? patient.created_at).slice(0, 10);
    return completedDate === today && !afterSeven;
  });
}

export async function getLiveBoardPatients() {
  const patients = await getTodaysPatients();
  const today = localDateKey(new Date());

  return patients.filter((patient) => !patient.cancelled && patient.operation_date === today);
}

function localDateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
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
    operation_date: patient.operation_date ?? patient.created_at.slice(0, 10),
    booking_cohort: patient.booking_cohort ?? ((patient.operation_date ?? patient.created_at.slice(0, 10)) > patient.created_at.slice(0, 10) ? "moved_to_planned" : "booked"),
    unresolved: patient.unresolved ?? false,
    unresolved_at: patient.unresolved_at ?? null,
    unresolved_from_stage: patient.unresolved_from_stage ?? null,
    reconciliation_reviewed_at: patient.reconciliation_reviewed_at ?? null,
    theatre_id: Object.prototype.hasOwnProperty.call(patient, "theatre_id") ? patient.theatre_id ?? null : DEFAULT_THEATRE_CONFIGURATION.theatres[0]?.id ?? null,
    recovery_area_id: Object.prototype.hasOwnProperty.call(patient, "recovery_area_id") ? patient.recovery_area_id ?? null : DEFAULT_THEATRE_CONFIGURATION.recovery_areas[0]?.id ?? null
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
  if (!isRolePermissionEnforced()) return data as WorkflowEvent[];
  const access = await getCurrentUserAccess();
  if (!access.authenticated) return data as WorkflowEvent[];
  if (access.role === "clinical_lead") {
    if (!access.specialty_ids.length) return [];
    const { data: patientSpecialties } = await supabase.from("patients").select("id,specialty");
    const allowedPatientIds = new Set((patientSpecialties ?? []).filter((patient) => access.specialty_ids.includes(String(patient.specialty))).map((patient) => patient.id));
    return (data as WorkflowEvent[]).filter((event) => allowedPatientIds.has(event.patient_id));
  }
  if (access.all_theatres) return data as WorkflowEvent[];
  const configuration = await getTheatreConfiguration();
  const allowedTheatreIds = new Set(configuration.theatres.map((theatre) => theatre.id));
  const { data: patientLocations } = await supabase.from("patients").select("id,theatre_id");
  const allowedPatientIds = new Set((patientLocations ?? []).filter((patient) => patient.theatre_id && allowedTheatreIds.has(patient.theatre_id)).map((patient) => patient.id));
  return (data as WorkflowEvent[]).filter((event) => allowedPatientIds.has(event.patient_id));
}

export async function getPatientListMovements(): Promise<PatientListMovement[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("patient_list_movements").select("*").order("moved_at", { ascending: true });
  if (error || !data) return [];
  return data as PatientListMovement[];
}

function normaliseCepodStages(stages: WorkflowStage[]) {
  const untimedStageIds = new Set(["patient-on-list", "anaesthetic-started", "operation-started"]);
  const withoutDecisionStage = stages
    .filter((stage) => stage.id !== "decision-to-operate")
    .map((stage) => untimedStageIds.has(stage.id) ? { ...stage, delay_threshold_minutes: 0 } : stage);
  const hasPatientOnList = withoutDecisionStage.some((stage) => stage.id === "patient-on-list");
  const patientOnList = DEFAULT_WORKFLOW_STAGES.find((stage) => stage.id === "patient-on-list");

  return [...(hasPatientOnList || !patientOnList ? [] : [patientOnList]), ...withoutDecisionStage].sort(
    (a, b) => a.display_order - b.display_order
  );
}

async function scopePatientsForCurrentUser<TPatient extends { theatre_id: string | null }>(patients: TPatient[]) {
  if (!isRolePermissionEnforced()) return patients;
  const access = await getCurrentUserAccess();
  if (!access.authenticated) return patients;
  if (access.role === "clinical_lead") {
    if (!access.specialty_ids.length) return [];
    return patients.filter((patient) => access.specialty_ids.includes(String((patient as TPatient & { specialty?: string }).specialty ?? "")));
  }
  if (access.all_theatres) return patients;
  const configuration = await getTheatreConfiguration();
  const allowedTheatreIds = new Set(configuration.theatres.map((theatre) => theatre.id));
  const canViewUnassigned = ["theatre_coordinator", "theatre_manager"].includes(access.role);
  return patients.filter((patient) => patient.theatre_id ? allowedTheatreIds.has(patient.theatre_id) : canViewUnassigned);
}
