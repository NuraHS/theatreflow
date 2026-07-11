create extension if not exists "pgcrypto";

begin;

create table if not exists public.workflows (
  id text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.workflows (id, name, description)
values ('cepod-emergency-theatres', 'CEPOD Emergency Theatres', 'Emergency operating theatre workflow tracking')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true;

create table if not exists public.workflow_stages (
  id text primary key,
  workflow_id text not null references public.workflows(id) on delete cascade,
  name text not null,
  display_order integer not null,
  colour text not null,
  delay_threshold_minutes integer not null default 30,
  board_band text not null
);

alter table public.workflow_stages
  add column if not exists workflow_id text,
  add column if not exists name text,
  add column if not exists display_order integer,
  add column if not exists colour text,
  add column if not exists delay_threshold_minutes integer default 30,
  add column if not exists board_band text;

update public.workflow_stages
set display_order = display_order + 100
where workflow_id = 'cepod-emergency-theatres';

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
  ('patient-out-of-recovery', 'cepod-emergency-theatres', 'Patient out of Recovery', 9, '#15803d', 25, 'Ward')
on conflict (id) do update
set
  workflow_id = excluded.workflow_id,
  name = excluded.name,
  display_order = excluded.display_order,
  colour = excluded.colour,
  delay_threshold_minutes = excluded.delay_threshold_minutes,
  board_band = excluded.board_band;

create table if not exists public.delay_reasons (
  id text primary key,
  label text not null unique,
  active boolean not null default true
);

insert into public.delay_reasons (id, label, active)
values
  ('missing-consent','Missing consent', true),
  ('consent-form-lost','Consent form lost', true),
  ('patient-eating','Patient eating', true),
  ('awaiting-bloods','Awaiting bloods', true),
  ('awaiting-imaging','Awaiting imaging', true),
  ('awaiting-review','Awaiting review', true),
  ('porter-unavailable','Porter unavailable', true),
  ('ward-delay','Ward delay', true),
  ('patient-unavailable','Patient unavailable', true),
  ('lift-failure','Lift failure', true),
  ('recovery-full','Recovery full', true),
  ('ward-bed-unavailable','Ward bed unavailable', true),
  ('icu-bed-unavailable','ICU bed unavailable', true),
  ('anaesthetist-unavailable','Anaesthetist unavailable', true),
  ('anaesthetist-attending-emergency','Anaesthetist attending emergency', true),
  ('equipment-unavailable','Equipment unavailable', true),
  ('instrument-unavailable','Instrument unavailable', true),
  ('cleaning-delay','Cleaning delay', true),
  ('previous-case-overran','Previous case overran', true),
  ('unexpected-difficult-surgery','Unexpected difficult surgery', true),
  ('emergency-interruption','Emergency interruption', true),
  ('staff-unavailable','Staff unavailable', true),
  ('documentation-unavailable','Documentation unavailable', true),
  ('other','Other', true)
on conflict (id) do update
set label = excluded.label, active = true;

create table if not exists public.priority_definitions (
  id text primary key,
  label text not null,
  target_minutes integer not null,
  colour text not null
);

insert into public.priority_definitions (id, label, target_minutes, colour)
values
  ('P1', 'P1: Immediate (<24hrs)', 30, '#dc2626'),
  ('P2', 'P2: Urgent', 120, '#facc15'),
  ('P3', 'P3: Expedited', 360, '#16a34a'),
  ('P4', 'P4: Elective', 1440, '#2563eb')
on conflict (id) do update
set
  label = excluded.label,
  target_minutes = excluded.target_minutes,
  colour = excluded.colour;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  hospital_number text not null,
  created_at timestamptz not null default now()
);

alter table public.patients
  add column if not exists hospital_number text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists patient_name text,
  add column if not exists consultant text,
  add column if not exists specialty text,
  add column if not exists procedure text,
  add column if not exists procedure_name text,
  add column if not exists cepod_priority text,
  add column if not exists operation_date date,
  add column if not exists current_stage text,
  add column if not exists cancelled boolean not null default false,
  add column if not exists cancellation_reason text,
  add column if not exists workflow_id text;

update public.patients
set
  hospital_number = coalesce(hospital_number, 'UNKNOWN'),
  consultant = coalesce(consultant, 'Not recorded'),
  specialty = coalesce(specialty, 'Not recorded'),
  procedure = coalesce(procedure, procedure_name, 'Not recorded'),
  procedure_name = coalesce(procedure_name, procedure, 'Not recorded'),
  operation_date = coalesce(operation_date, created_at::date),
  cepod_priority = case cepod_priority
    when 'Immediate' then 'P1'
    when 'Urgent' then 'P2'
    when 'Expedited' then 'P3'
    when 'Elective' then 'P4'
    else coalesce(cepod_priority, 'P2')
  end,
  current_stage = case current_stage
    when 'decision-to-operate' then 'patient-on-list'
    when 'Decision to operate' then 'patient-on-list'
    when 'Patient on list' then 'patient-on-list'
    when 'knife-to-skin' then 'operation-started'
    when 'procedure-finished' then 'operation-finished'
    when 'out-of-theatre' then 'patient-in-recovery'
    when 'recovery-ready' then 'patient-in-recovery'
    when 'left-recovery' then 'patient-out-of-recovery'
    when 'returned-to-ward' then 'patient-out-of-recovery'
    else coalesce(current_stage, 'patient-on-list')
  end,
  workflow_id = coalesce(workflow_id, 'cepod-emergency-theatres');

alter table public.patients
  alter column hospital_number set not null,
  alter column consultant set not null,
  alter column specialty set not null,
  alter column procedure set not null,
  alter column procedure_name set not null,
  alter column operation_date set not null,
  alter column operation_date set default current_date,
  alter column cepod_priority set not null,
  alter column current_stage set not null,
  alter column workflow_id set not null;

create table if not exists public.workflow_events (
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

alter table public.workflow_events
  add column if not exists patient_id uuid,
  add column if not exists workflow_stage_id text,
  add column if not exists timestamp timestamptz not null default now(),
  add column if not exists user_id uuid,
  add column if not exists user_name text,
  add column if not exists delay_reason_ids text[] not null default '{}',
  add column if not exists delay_comments text,
  add column if not exists infrastructure_event_ids uuid[] not null default '{}';

update public.workflow_events
set
  user_name = coalesce(user_name, 'Unknown user'),
  workflow_stage_id = case workflow_stage_id
    when 'decision-to-operate' then 'patient-on-list'
    when 'knife-to-skin' then 'operation-started'
    when 'procedure-finished' then 'operation-finished'
    when 'out-of-theatre' then 'patient-in-recovery'
    when 'recovery-ready' then 'patient-in-recovery'
    when 'left-recovery' then 'patient-out-of-recovery'
    when 'returned-to-ward' then 'patient-out-of-recovery'
    else coalesce(workflow_stage_id, 'patient-on-list')
  end;

alter table public.workflow_events
  alter column user_name set not null,
  alter column workflow_stage_id set not null;

create table if not exists public.infrastructure_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  description text not null,
  severity text not null default 'medium',
  active boolean not null default true
);

alter table public.infrastructure_events
  add column if not exists type text,
  add column if not exists start_time timestamptz not null default now(),
  add column if not exists end_time timestamptz,
  add column if not exists description text,
  add column if not exists severity text not null default 'medium',
  add column if not exists active boolean not null default true;

update public.infrastructure_events
set
  type = coalesce(type, 'Other'),
  description = coalesce(description, 'Not recorded'),
  severity = coalesce(severity, 'medium');

alter table public.infrastructure_events
  alter column type set not null,
  alter column description set not null,
  alter column severity set not null;

create table if not exists public.audit_log (
  id bigserial primary key,
  table_name text not null,
  row_id text not null,
  action text not null,
  user_id uuid,
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb
);

create index if not exists patients_created_at_idx on public.patients(created_at desc);
create index if not exists patients_current_stage_idx on public.patients(current_stage);
create index if not exists patients_hospital_number_idx on public.patients(hospital_number);
create index if not exists workflow_events_patient_idx on public.workflow_events(patient_id, timestamp desc);

delete from public.workflow_stages
where id in ('decision-to-operate', 'knife-to-skin', 'procedure-finished', 'out-of-theatre', 'recovery-ready', 'left-recovery', 'returned-to-ward');

notify pgrst, 'reload schema';

commit;
