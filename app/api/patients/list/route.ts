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

  return NextResponse.json({ ok: true });
}
