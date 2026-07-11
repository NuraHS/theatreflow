create extension if not exists "pgcrypto";

create type public.user_role as enum (
  'administrator',
  'manager',
  'clinical_lead',
  'consultant',
  'theatre_staff',
  'read_only_auditor'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'theatre_staff',
  created_at timestamptz not null default now()
);

create table public.workflows (
  id text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workflow_stages (
  id text primary key,
  workflow_id text not null references public.workflows(id) on delete cascade,
  name text not null,
  display_order integer not null,
  colour text not null,
  delay_threshold_minutes integer not null default 30,
  board_band text not null,
  unique (workflow_id, display_order)
);

create table public.delay_reasons (
  id text primary key,
  label text not null unique,
  active boolean not null default true
);

create table public.consultants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);

create table public.priority_definitions (
  id text primary key,
  label text not null,
  target_minutes integer not null,
  colour text not null
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  hospital_number text not null,
  patient_name text,
  consultant text not null,
  specialty text not null,
  procedure text not null,
  cepod_priority text not null,
  created_at timestamptz not null default now(),
  current_stage text not null references public.workflow_stages(id),
  cancelled boolean not null default false,
  cancellation_reason text,
  workflow_id text not null references public.workflows(id)
);

create index patients_created_at_idx on public.patients(created_at desc);
create index patients_current_stage_idx on public.patients(current_stage);
create index patients_hospital_number_idx on public.patients(hospital_number);

create table public.infrastructure_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  description text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  active boolean not null default true
);

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  workflow_stage_id text not null references public.workflow_stages(id),
  timestamp timestamptz not null default now(),
  user_id uuid references auth.users(id),
  user_name text not null,
  delay_reason_ids text[] not null default '{}',
  delay_comments text,
  infrastructure_event_ids uuid[] not null default '{}'
);

create index workflow_events_patient_idx on public.workflow_events(patient_id, timestamp desc);
create index workflow_events_delay_reasons_idx on public.workflow_events using gin(delay_reason_ids);
create index workflow_events_infra_idx on public.workflow_events using gin(infrastructure_event_ids);

create table public.audit_log (
  id bigserial primary key,
  table_name text not null,
  row_id text not null,
  action text not null,
  user_id uuid,
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb
);

alter table public.profiles enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_stages enable row level security;
alter table public.delay_reasons enable row level security;
alter table public.consultants enable row level security;
alter table public.specialties enable row level security;
alter table public.priority_definitions enable row level security;
alter table public.patients enable row level security;
alter table public.infrastructure_events enable row level security;
alter table public.workflow_events enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'theatre_staff'::public.user_role);
$$;

create or replace function public.has_any_role(allowed public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = any(allowed);
$$;

create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.has_any_role(array['administrator']::public.user_role[]));
create policy "profiles admin write" on public.profiles for all using (public.has_any_role(array['administrator']::public.user_role[]));

create policy "reference read" on public.workflows for select using (auth.role() = 'authenticated');
create policy "stages read" on public.workflow_stages for select using (auth.role() = 'authenticated');
create policy "delay reasons read" on public.delay_reasons for select using (auth.role() = 'authenticated');
create policy "priority read" on public.priority_definitions for select using (auth.role() = 'authenticated');
create policy "consultants read" on public.consultants for select using (auth.role() = 'authenticated');
create policy "specialties read" on public.specialties for select using (auth.role() = 'authenticated');

create policy "admin workflows" on public.workflows for all using (public.has_any_role(array['administrator']::public.user_role[]));
create policy "admin stages" on public.workflow_stages for all using (public.has_any_role(array['administrator']::public.user_role[]));
create policy "admin delay reasons" on public.delay_reasons for all using (public.has_any_role(array['administrator']::public.user_role[]));
create policy "admin priorities" on public.priority_definitions for all using (public.has_any_role(array['administrator']::public.user_role[]));
create policy "admin consultants" on public.consultants for all using (public.has_any_role(array['administrator']::public.user_role[]));
create policy "admin specialties" on public.specialties for all using (public.has_any_role(array['administrator']::public.user_role[]));

create policy "patients read" on public.patients for select using (auth.role() = 'authenticated');
create policy "patients write" on public.patients for insert with check (
  public.has_any_role(array['administrator','manager','clinical_lead','consultant','theatre_staff']::public.user_role[])
);
create policy "patients update" on public.patients for update using (
  public.has_any_role(array['administrator','manager','clinical_lead','consultant','theatre_staff']::public.user_role[])
);

create policy "workflow events read" on public.workflow_events for select using (auth.role() = 'authenticated');
create policy "workflow events insert" on public.workflow_events for insert with check (
  public.has_any_role(array['administrator','manager','clinical_lead','consultant','theatre_staff']::public.user_role[])
);

create policy "infrastructure read" on public.infrastructure_events for select using (auth.role() = 'authenticated');
create policy "infrastructure write" on public.infrastructure_events for all using (
  public.has_any_role(array['administrator','manager','clinical_lead']::public.user_role[])
);

create policy "audit read" on public.audit_log for select using (
  public.has_any_role(array['administrator','manager','clinical_lead','read_only_auditor']::public.user_role[])
);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log(table_name, row_id, action, user_id, old_value, new_value)
  values (
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger patients_audit after insert or update on public.patients
for each row execute function public.write_audit_log();

create trigger workflow_events_audit after insert on public.workflow_events
for each row execute function public.write_audit_log();

create trigger infrastructure_events_audit after insert or update on public.infrastructure_events
for each row execute function public.write_audit_log();

create trigger workflow_stages_audit after insert or update on public.workflow_stages
for each row execute function public.write_audit_log();

create trigger delay_reasons_audit after insert or update on public.delay_reasons
for each row execute function public.write_audit_log();

create policy "audit immutable" on public.audit_log for insert with check (false);
create policy "audit no update" on public.audit_log for update using (false);
create policy "audit no delete" on public.audit_log for delete using (false);

insert into public.workflows (id, name, description)
values ('cepod-emergency-theatres', 'CEPOD Emergency Theatres', 'Emergency operating theatre workflow tracking');

insert into public.workflow_stages (id, workflow_id, name, display_order, colour, delay_threshold_minutes, board_band)
values
  ('patient-on-list', 'cepod-emergency-theatres', 'Patient on list', 1, '#64748b', 30, 'Waiting'),
  ('sent-for', 'cepod-emergency-theatres', 'Patient Sent For', 2, '#0891b2', 20, 'Sent For'),
  ('patient-arrived', 'cepod-emergency-theatres', 'Patient Arrived in Anaesthetic Room', 3, '#2563eb', 15, 'Arrived'),
  ('anaesthetic-started', 'cepod-emergency-theatres', 'Anaesthetic Started', 4, '#7c3aed', 35, 'Anaesthetic'),
  ('patient-in-theatre', 'cepod-emergency-theatres', 'Patient in Theatre', 5, '#0e7490', 15, 'Operating'),
  ('operation-started', 'cepod-emergency-theatres', 'Operation started', 6, '#dc2626', 120, 'Operating'),
  ('operation-finished', 'cepod-emergency-theatres', 'Operation finished', 7, '#ea580c', 20, 'Operating'),
  ('patient-in-recovery', 'cepod-emergency-theatres', 'Patient in Recovery', 8, '#16a34a', 30, 'Recovery'),
  ('patient-out-of-recovery', 'cepod-emergency-theatres', 'Patient out of Recovery', 9, '#15803d', 25, 'Ward');

insert into public.delay_reasons (id, label)
values
  ('missing-consent','Missing consent'),
  ('consent-form-lost','Consent form lost'),
  ('patient-eating','Patient eating'),
  ('awaiting-bloods','Awaiting bloods'),
  ('awaiting-imaging','Awaiting imaging'),
  ('awaiting-review','Awaiting review'),
  ('porter-unavailable','Porter unavailable'),
  ('ward-delay','Ward delay'),
  ('patient-unavailable','Patient unavailable'),
  ('lift-failure','Lift failure'),
  ('recovery-full','Recovery full'),
  ('ward-bed-unavailable','Ward bed unavailable'),
  ('icu-bed-unavailable','ICU bed unavailable'),
  ('anaesthetist-unavailable','Anaesthetist unavailable'),
  ('anaesthetist-attending-emergency','Anaesthetist attending emergency'),
  ('equipment-unavailable','Equipment unavailable'),
  ('instrument-unavailable','Instrument unavailable'),
  ('cleaning-delay','Cleaning delay'),
  ('previous-case-overran','Previous case overran'),
  ('unexpected-difficult-surgery','Unexpected difficult surgery'),
  ('emergency-interruption','Emergency interruption'),
  ('staff-unavailable','Staff unavailable'),
  ('documentation-unavailable','Documentation unavailable'),
  ('other','Other');

insert into public.priority_definitions (id, label, target_minutes, colour)
values
  ('P1', 'P1', 30, '#dc2626'),
  ('P2', 'P2', 120, '#facc15'),
  ('P3', 'P3', 360, '#16a34a'),
  ('P4', 'P4', 1440, '#2563eb');
