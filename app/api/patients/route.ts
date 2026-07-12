import { NextResponse } from "next/server";
import { DEFAULT_WORKFLOW_ID } from "@/lib/constants/workflow";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createPatientSchema } from "@/lib/services/schemas";

export async function POST(request: Request) {
  const payload = createPatientSchema.parse(await request.json());
  const authSupabase = await createServerSupabaseClient();
  const supabase = createServiceRoleSupabaseClient() ?? authSupabase;
  const now = new Date().toISOString();
  const created_at = payload.decision_to_operate_time ? new Date(payload.decision_to_operate_time).toISOString() : now;
  const operation_date = payload.operation_date || toDateInputValue(new Date());
  const booking_cohort: "booked" | "moved_to_planned" = operation_date > toDateInputValue(new Date(created_at)) ? "moved_to_planned" : "booked";

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      demo: true,
      patient: {
        id: crypto.randomUUID(),
        ...payload,
        operation_date,
        created_at,
        current_stage: "patient-on-list",
        cancelled: false,
        cancellation_reason: null,
        booking_cohort,
        workflow_id: DEFAULT_WORKFLOW_ID
      }
    });
  }

  const {
    data: { user }
  } = authSupabase ? await authSupabase.auth.getUser() : { data: { user: null } };

  const patientInsert = {
    hospital_number: payload.hospital_number,
    patient_name: payload.patient_name || null,
    consultant: payload.consultant,
    specialty: payload.specialty,
    procedure: payload.procedure,
    procedure_name: payload.procedure,
    cepod_priority: payload.cepod_priority,
    operation_date,
    created_at,
    current_stage: "patient-on-list",
    cancelled: false,
    cancellation_reason: null,
    booking_cohort,
    workflow_id: DEFAULT_WORKFLOW_ID
  };

  const { data, error } = await insertPatientWithSchemaFallback(supabase, patientInsert);

  if (error) {
    const schemaHint = error.message.includes("schema cache")
      ? " Supabase schema is missing a column expected by the app. Run the latest Theatreflow migration SQL in Supabase, then reload the schema cache if needed."
      : "";
    return NextResponse.json({ error: `${error.message}${schemaHint}` }, { status: 400 });
  }

  await supabase.from("workflow_events").insert({
    patient_id: data.id,
    workflow_stage_id: "patient-on-list",
    timestamp: created_at,
    user_id: user?.id ?? null,
    user_name: user?.email ?? "Unknown user",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  });

  return NextResponse.json({ ok: true, patient: data });
}

type PatientInsert = {
  hospital_number: string;
  patient_name: string | null;
  consultant: string;
  specialty: string;
  procedure: string;
  procedure_name: string;
  cepod_priority: string;
  operation_date: string;
  created_at: string;
  current_stage: string;
  cancelled: boolean;
  cancellation_reason: string | null;
  booking_cohort: "booked" | "moved_to_planned";
  workflow_id: string;
};

async function insertPatientWithSchemaFallback(supabase: NonNullable<ReturnType<typeof createServiceRoleSupabaseClient>>, patient: PatientInsert) {
  const firstAttempt = await supabase.from("patients").insert(patient).select().single();

  if (!firstAttempt.error) return firstAttempt;

  if (firstAttempt.error.message.includes("'procedure_name'") || firstAttempt.error.message.includes("procedure_name")) {
    const withoutProcedureName = omitPatientColumn(patient, "procedure_name");
    return supabase.from("patients").insert(withoutProcedureName).select().single();
  }

  if (firstAttempt.error.message.includes("booking_cohort")) {
    const withoutBookingCohort = omitPatientColumn(patient, "booking_cohort");
    return supabase.from("patients").insert(withoutBookingCohort).select().single();
  }

  if (firstAttempt.error.message.includes("'operation_date'") || firstAttempt.error.message.includes("operation_date")) {
    const withoutOperationDate = omitPatientColumn(patient, "operation_date");
    return supabase.from("patients").insert(withoutOperationDate).select().single();
  }

  if (firstAttempt.error.message.includes("'procedure'") || firstAttempt.error.message.includes("procedure")) {
    const withoutProcedure = omitPatientColumn(patient, "procedure");
    return supabase.from("patients").insert(withoutProcedure).select().single();
  }

  return firstAttempt;
}

function omitPatientColumn<TColumn extends keyof PatientInsert>(patient: PatientInsert, column: TColumn) {
  const next: Partial<PatientInsert> = { ...patient };
  delete next[column];
  return next;
}

function toDateInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}
