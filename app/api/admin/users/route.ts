import { NextResponse } from "next/server";
import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/constants/permissions";
import { getCurrentUserAccess, hasPermission } from "@/lib/services/access-control";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile, UserRole } from "@/lib/types/domain";

const roleSchema = z.enum(ASSIGNABLE_ROLES as [UserRole, ...UserRole[]]);
const accessSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  job_title: z.string().trim().max(120).optional(),
  role: roleSchema,
  active: z.boolean().default(true),
  primary_suite_id: z.string().uuid().nullable().optional(),
  suite_ids: z.array(z.string().uuid()).default([]),
  theatre_ids: z.array(z.string().uuid()).default([]),
  specialty_ids: z.array(z.string().trim().min(1).max(120)).default([])
});
const createUserSchema = accessSchema.extend({
  email: z.string().email(),
  temporary_password: z.string().min(12, "Temporary password must contain at least 12 characters")
});
const updateUserSchema = accessSchema.extend({ id: z.string().uuid() });

export async function GET() {
  if (!(await hasPermission("manageUsers"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "The Supabase service role is required for user administration." }, { status: 503 });

  const [profiles, suiteAccess, theatreAccess, specialtyAccess] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,job_title,role,active,primary_suite_id").order("full_name"),
    supabase.from("profile_suite_access").select("profile_id,suite_id"),
    supabase.from("profile_theatre_access").select("profile_id,theatre_id"),
    supabase.from("profile_specialty_access").select("profile_id,specialty")
  ]);
  const error = profiles.error ?? suiteAccess.error ?? theatreAccess.error;
  if (error) return NextResponse.json({ error: `${error.message} Run migration 0010_authentication_roles_and_theatre_locations.sql.` }, { status: 400 });

  const users: UserProfile[] = (profiles.data ?? []).map((profile) => ({
    ...profile,
    role: profile.role as UserRole,
    suite_ids: (suiteAccess.data ?? []).filter((item) => item.profile_id === profile.id).map((item) => item.suite_id),
    theatre_ids: (theatreAccess.data ?? []).filter((item) => item.profile_id === profile.id).map((item) => item.theatre_id),
    specialty_ids: (specialtyAccess.data ?? []).filter((item) => item.profile_id === profile.id).map((item) => item.specialty)
  }));
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!(await hasPermission("manageUsers"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid user profile." }, { status: 400 });
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "The Supabase service role is required for user administration." }, { status: 503 });

  const { email, temporary_password, ...access } = parsed.data;
  if (access.role === "clinical_lead") {
    const specialtyTable = await supabase.from("profile_specialty_access").select("profile_id").limit(1);
    if (specialtyTable.error) return NextResponse.json({ error: "Apply migration 0011_clinical_lead_specialty_access.sql before creating a clinical lead account." }, { status: 503 });
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporary_password,
    email_confirm: true,
    user_metadata: { full_name: access.full_name }
  });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Unable to create authentication account." }, { status: 400 });

  const profileError = await saveAccess(data.user.id, email, access);
  if (profileError) return NextResponse.json({ error: `The login was created, but its access profile could not be saved: ${profileError}` }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.user.id });
}

export async function PATCH(request: Request) {
  if (!(await hasPermission("manageUsers"))) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid user profile." }, { status: 400 });
  const currentUser = await getCurrentUserAccess();
  if (parsed.data.id === currentUser.id && !parsed.data.active) return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "The Supabase service role is required for user administration." }, { status: 503 });

  const { id, ...access } = parsed.data;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", id).maybeSingle();
  const error = await saveAccess(id, profile?.email ?? null, access);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

async function saveAccess(id: string, email: string | null, access: z.infer<typeof accessSchema>) {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return "Supabase service role is not configured.";
  const clinicalLead = access.role === "clinical_lead";
  const { error: profileError } = await supabase.from("profiles").upsert({
    id,
    email,
    full_name: access.full_name,
    job_title: access.job_title || null,
    role: access.role,
    active: access.active,
    primary_suite_id: clinicalLead ? null : access.primary_suite_id || null,
    updated_at: new Date().toISOString()
  });
  if (profileError) return profileError.message;

  const [suiteDelete, theatreDelete, specialtyDelete] = await Promise.all([
    supabase.from("profile_suite_access").delete().eq("profile_id", id),
    supabase.from("profile_theatre_access").delete().eq("profile_id", id),
    supabase.from("profile_specialty_access").delete().eq("profile_id", id)
  ]);
  if (suiteDelete.error || theatreDelete.error) return suiteDelete.error?.message ?? theatreDelete.error?.message ?? "Unable to replace access assignments.";
  if (specialtyDelete.error && clinicalLead) return "Apply migration 0011_clinical_lead_specialty_access.sql before saving clinical lead specialties.";

  const suiteIds = clinicalLead ? [] : [...new Set([...(access.suite_ids ?? []), ...(access.primary_suite_id ? [access.primary_suite_id] : [])])];
  const theatreIds = clinicalLead ? [] : [...new Set(access.theatre_ids)];
  const specialtyIds = clinicalLead ? [...new Set(access.specialty_ids)] : [];
  const [suiteInsert, theatreInsert, specialtyInsert] = await Promise.all([
    suiteIds.length ? supabase.from("profile_suite_access").insert(suiteIds.map((suite_id) => ({ profile_id: id, suite_id, can_manage: ["theatre_coordinator", "theatre_manager"].includes(access.role) }))) : Promise.resolve({ error: null }),
    theatreIds.length ? supabase.from("profile_theatre_access").insert(theatreIds.map((theatre_id) => ({ profile_id: id, theatre_id }))) : Promise.resolve({ error: null }),
    specialtyIds.length ? supabase.from("profile_specialty_access").insert(specialtyIds.map((specialty) => ({ profile_id: id, specialty }))) : Promise.resolve({ error: null })
  ]);
  return suiteInsert.error?.message ?? theatreInsert.error?.message ?? specialtyInsert.error?.message ?? null;
}
