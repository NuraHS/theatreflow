"use client";

import * as React from "react";
import { KeyRound, Plus, RefreshCw, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SUPPORTED_SPECIALTIES } from "@/lib/constants/clinical-teams";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants/permissions";
import type { TheatreConfiguration, UserProfile, UserRole } from "@/lib/types/domain";

type EditableAccess = Pick<UserProfile, "full_name" | "job_title" | "role" | "active" | "primary_suite_id" | "suite_ids" | "theatre_ids" | "specialty_ids">;
type NewUserAccess = Omit<EditableAccess, "full_name" | "job_title"> & { full_name: string; job_title: string; email: string; temporary_password: string };

export function UserAccessPanel({ locations }: { locations: TheatreConfiguration }) {
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newUser, setNewUser] = React.useState<NewUserAccess>({
    email: "",
    temporary_password: "",
    full_name: "",
    job_title: "",
    role: "administrator" as UserRole,
    active: true,
    primary_suite_id: locations.suites[0]?.id ?? null,
    suite_ids: [] as string[],
    theatre_ids: locations.theatres[0]?.id ? [locations.theatres[0].id] : [],
    specialty_ids: [] as string[]
  });

  const loadUsers = React.useCallback(async (announce = false) => {
    setLoading(true);
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const result = (await response.json()) as { users?: UserProfile[]; error?: string };
    setLoading(false);
    if (!response.ok) return toast.error(result.error ?? "Unable to load user profiles.");
    setUsers(result.users ?? []);
    if (announce) toast.success("User access refreshed.");
  }, []);

  React.useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) });
    const result = (await response.json()) as { error?: string };
    setCreating(false);
    if (!response.ok) return toast.error(result.error ?? "Unable to create user.");
    toast.success("Login account and access profile created.");
    setShowCreate(false);
    setNewUser((current) => ({ ...current, email: "", temporary_password: "", full_name: "", job_title: "" }));
    await loadUsers();
  }

  return (
    <div className="space-y-4">
      <Card className="border-cyan-300 dark:border-cyan-900">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 text-primary" aria-hidden="true" /><div><h2 className="font-bold">Management access controls</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Roles decide which privileged pages are available. Theatre managers are scoped by suite and theatre; clinical leads are scoped by specialty.</p></div></div>
          <div className="flex gap-2"><Button type="button" variant="outline" disabled={loading} onClick={() => void loadUsers(true)}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />Refresh</Button><Button type="button" onClick={() => setShowCreate((current) => !current)}><Plus className="h-4 w-4" aria-hidden="true" />New user</Button></div>
        </CardContent>
      </Card>

      {showCreate ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />Create login account</CardTitle><p className="text-sm text-muted-foreground">The temporary password is set locally and is never stored in the profile table.</p></CardHeader>
          <CardContent>
            <form onSubmit={createUser} className="grid gap-4 md:grid-cols-2">
              <FormField label="Full name"><Input required value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} /></FormField>
              <FormField label="Job title"><Input value={newUser.job_title} onChange={(event) => setNewUser({ ...newUser, job_title: event.target.value })} /></FormField>
              <FormField label="Email address"><Input type="email" autoComplete="off" required value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></FormField>
              <FormField label="Temporary password"><Input type="password" autoComplete="new-password" minLength={12} required value={newUser.temporary_password} onChange={(event) => setNewUser({ ...newUser, temporary_password: event.target.value })} /></FormField>
              <RoleSelect value={newUser.role} onChange={(role) => setNewUser({ ...newUser, role, ...(role === "clinical_lead" ? { primary_suite_id: null, suite_ids: [], theatre_ids: [] } : {}) })} />
              {newUser.role === "clinical_lead" ? (
                <div className="md:col-span-2"><SpecialtyChecks selected={newUser.specialty_ids} onChange={(specialty_ids) => setNewUser({ ...newUser, specialty_ids })} /></div>
              ) : (
                <><SuiteSelect locations={locations} value={newUser.primary_suite_id} onChange={(primary_suite_id) => setNewUser({ ...newUser, primary_suite_id })} /><div className="md:col-span-2"><TheatreChecks locations={locations} selected={newUser.theatre_ids} primarySuiteId={newUser.primary_suite_id} onChange={(theatre_ids) => setNewUser({ ...newUser, theatre_ids })} /></div></>
              )}
              <Button type="submit" size="lg" className="md:col-span-2" disabled={creating}>{creating ? "Creating account..." : "Create account"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {users.map((user) => <UserAccessCard key={user.id} user={user} locations={locations} onSaved={() => void loadUsers()} />)}
      </div>
      {!loading && !users.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No authentication profiles are available. Apply migration 0010, then create the first administrator while role enforcement is disabled.</CardContent></Card> : null}
    </div>
  );
}

function UserAccessCard({ user, locations, onSaved }: { user: UserProfile; locations: TheatreConfiguration; onSaved: () => void }) {
  const [profile, setProfile] = React.useState<EditableAccess>({ full_name: user.full_name, job_title: user.job_title, role: user.role, active: user.active, primary_suite_id: user.primary_suite_id, suite_ids: user.suite_ids, theatre_ids: user.theatre_ids, specialty_ids: user.specialty_ids ?? [] });
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, ...profile, full_name: profile.full_name || user.email || "Theatreflow user" }) });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) return toast.error(result.error ?? "Unable to save access.");
    toast.success(`Access saved for ${profile.full_name || user.email}.`);
    onSaved();
  }

  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-5 w-5" aria-hidden="true" /></span><div><CardTitle className="text-lg">{user.full_name || user.email}</CardTitle><p className="text-sm text-muted-foreground">{user.email}</p></div></div><Badge tone={profile.active ? "green" : "red"}>{profile.active ? "Active" : "Inactive"}</Badge></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><FormField label="Full name"><Input value={profile.full_name ?? ""} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} /></FormField><FormField label="Job title"><Input value={profile.job_title ?? ""} onChange={(event) => setProfile({ ...profile, job_title: event.target.value })} /></FormField><RoleSelect value={profile.role} onChange={(role) => setProfile({ ...profile, role, ...(role === "clinical_lead" ? { primary_suite_id: null, suite_ids: [], theatre_ids: [] } : {}) })} />{profile.role === "clinical_lead" ? null : <SuiteSelect locations={locations} value={profile.primary_suite_id} onChange={(primary_suite_id) => setProfile({ ...profile, primary_suite_id })} />}</div>
        {profile.role === "clinical_lead" ? <SpecialtyChecks selected={profile.specialty_ids} onChange={(specialty_ids) => setProfile({ ...profile, specialty_ids })} /> : <TheatreChecks locations={locations} selected={profile.theatre_ids} primarySuiteId={profile.primary_suite_id} onChange={(theatre_ids) => setProfile({ ...profile, theatre_ids })} />}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3"><input type="checkbox" checked={profile.active} onChange={(event) => setProfile({ ...profile, active: event.target.checked })} /><span className="text-sm font-semibold">Account active</span></label>
        <Button type="button" className="w-full" disabled={saving} onClick={() => void save()}><Save className="h-4 w-4" aria-hidden="true" />{saving ? "Saving..." : "Save role and access"}</Button>
      </CardContent>
    </Card>
  );
}

function RoleSelect({ value, onChange }: { value: UserRole; onChange: (role: UserRole) => void }) {
  return <div className="space-y-2"><Label>Role</Label><Select value={value} onChange={(event) => onChange(event.target.value as UserRole)}>{ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</Select><p className="text-xs leading-relaxed text-muted-foreground">{ROLE_DESCRIPTIONS[value]}</p></div>;
}

function SuiteSelect({ locations, value, onChange }: { locations: TheatreConfiguration; value: string | null; onChange: (suiteId: string | null) => void }) {
  return <div className="space-y-2"><Label>Primary theatre suite</Label><Select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}><option value="">No primary suite</option>{locations.suites.map((suite) => <option key={suite.id} value={suite.id}>{suite.name}</option>)}</Select></div>;
}

function TheatreChecks({ locations, selected, primarySuiteId, onChange }: { locations: TheatreConfiguration; selected: string[]; primarySuiteId: string | null; onChange: (ids: string[]) => void }) {
  return <fieldset className="space-y-3"><legend className="text-sm font-semibold">Assigned theatres</legend><div className="space-y-3">{[...locations.suites].sort((a, b) => a.display_order - b.display_order).map((suite) => { const theatres = locations.theatres.filter((theatre) => theatre.suite_id === suite.id).sort((a, b) => a.display_order - b.display_order); return <div key={suite.id} className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-start"><div><p className="font-bold">{suite.name}</p>{primarySuiteId === suite.id ? <Badge tone="blue" className="mt-2">Primary suite</Badge> : null}</div><div className="flex flex-wrap gap-2">{theatres.map((theatre) => { const checked = selected.includes(theatre.id); return <label key={theatre.id} className={checked ? "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-primary bg-cyan-50 px-3 text-sm font-semibold dark:bg-cyan-950/25" : "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-muted"}><input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== theatre.id) : [...selected, theatre.id])} />{theatre.name}</label>; })}</div></div>; })}</div><p className="text-xs text-muted-foreground">Choose the theatres this management account is responsible for. The suite name remains visible beside each group.</p></fieldset>;
}

function SpecialtyChecks({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">Assigned specialties</legend><div className="flex flex-wrap gap-2">{SUPPORTED_SPECIALTIES.map((specialty) => { const checked = selected.includes(specialty); return <label key={specialty} className={checked ? "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-primary bg-cyan-50 px-3 text-sm font-semibold dark:bg-cyan-950/25" : "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-muted"}><input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== specialty) : [...selected, specialty])} />{specialty}</label>; })}</div><p className="text-xs text-muted-foreground">Clinical leads see patient and reporting data for the selected specialties across theatre suites.</p></fieldset>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const id = React.useId();
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}</div>;
}
