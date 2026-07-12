import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const movePatientListSchema = z.object({
  patient_id: z.string().min(1),
  operation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function PATCH(request: Request) {
  const payload = movePatientListSchema.parse(await request.json());
  const authSupabase = await createServerSupabaseClient();
  const supabase = createServiceRoleSupabaseClient() ?? authSupabase;

  if (!supabase) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const { data: existing } = await supabase.from("patients").select("operation_date").eq("id", payload.patient_id).single();
  const movedAt = new Date();

  const { error } = await supabase
    .from("patients")
    .update({ operation_date: payload.operation_date })
    .eq("id", payload.patient_id);

  if (error) {
    const schemaHint = error.message.includes("operation_date") || error.message.includes("schema cache")
      ? " Supabase is missing the operation_date column. Run supabase/migrations/0004_add_operation_date.sql in the SQL editor, then reload the schema cache if needed."
      : "";
    return NextResponse.json({ error: `${error.message}${schemaHint}` }, { status: 400 });
  }


  const fromDate = existing?.operation_date ?? null;
  const today = localDateKey(movedAt);
  const movementType = payload.operation_date === today ? "to_cepod" : payload.operation_date > today ? "to_planned" : "rescheduled";
  if (movementType === "to_planned") {
    await supabase.from("patients").update({ booking_cohort: "moved_to_planned" }).eq("id", payload.patient_id);
  }
  await supabase.from("patient_list_movements").insert({
    patient_id: payload.patient_id,
    from_operation_date: fromDate,
    to_operation_date: payload.operation_date,
    moved_at: movedAt.toISOString(),
    movement_type: movementType
  });

  return NextResponse.json({ ok: true });
}

function localDateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
