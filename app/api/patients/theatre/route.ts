import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessPatient, canAccessTheatre, hasPermission } from "@/lib/services/access-control";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ patient_id: z.string().uuid(), theatre_id: z.string().uuid() });

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid patient and theatre." }, { status: 400 });
  if (!(await hasPermission("advanceWorkflow")) || !(await canAccessPatient(parsed.data.patient_id)) || !(await canAccessTheatre(parsed.data.theatre_id))) {
    return NextResponse.json({ error: "You do not have permission to change this patient's theatre or use the selected theatre." }, { status: 403 });
  }
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "The database is not configured for saving theatre changes." }, { status: 503 });
  const { data: theatre, error: theatreError } = await supabase.from("theatres")
    .select("id,suite_id,default_recovery_area_id").eq("id", parsed.data.theatre_id).eq("active", true).maybeSingle();
  if (theatreError) return NextResponse.json({ error: "Unable to verify the selected theatre." }, { status: 503 });
  if (!theatre) return NextResponse.json({ error: "The selected theatre is no longer available." }, { status: 400 });
  const { data: suite, error: suiteError } = await supabase.from("theatre_suites").select("id").eq("id", theatre.suite_id).eq("active", true).maybeSingle();
  if (suiteError) return NextResponse.json({ error: "Unable to verify the selected suite." }, { status: 503 });
  if (!suite) return NextResponse.json({ error: "The selected suite is no longer available." }, { status: 400 });
  const { data: patient, error: patientError } = await supabase.from("patients").select("id,theatre_id").eq("id", parsed.data.patient_id).maybeSingle();
  if (patientError) return NextResponse.json({ error: "Unable to read the patient booking." }, { status: 503 });
  if (!patient) return NextResponse.json({ error: "The patient booking could not be found." }, { status: 404 });
  if (!(await canAccessTheatre(patient.theatre_id))) return NextResponse.json({ error: "You no longer have access to this booking’s current theatre. Refresh and try again." }, { status: 403 });
  if (patient.theatre_id === theatre.id) return NextResponse.json({ ok: true });
  // Only location fields change. Conditional update avoids overwriting a concurrent move.
  let update = supabase.from("patients").update({ theatre_id: theatre.id, recovery_area_id: theatre.default_recovery_area_id ?? null }).eq("id", patient.id);
  update = patient.theatre_id ? update.eq("theatre_id", patient.theatre_id) : update.is("theatre_id", null);
  const { data: saved, error } = await update.select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to save the theatre change. Please try again." }, { status: 400 });
  if (!saved) return NextResponse.json({ error: "This booking changed while you were editing it. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
