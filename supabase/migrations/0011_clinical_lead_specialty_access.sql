begin;

-- Clinical leads are scoped by specialty across theatre suites rather than by
-- physical theatre assignment.
create table if not exists public.profile_specialty_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  specialty text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, specialty)
);

create index if not exists profile_specialty_access_specialty_idx
on public.profile_specialty_access(specialty);

alter table public.profile_specialty_access enable row level security;

drop policy if exists "specialty access self read" on public.profile_specialty_access;
drop policy if exists "specialty access admin write" on public.profile_specialty_access;

create policy "specialty access self read" on public.profile_specialty_access
for select using (profile_id = auth.uid() or public.is_theatreflow_administrator());

create policy "specialty access admin write" on public.profile_specialty_access
for all using (public.is_theatreflow_administrator())
with check (public.is_theatreflow_administrator());

create or replace function public.can_access_specialty(target_specialty text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_theatreflow_role_text() = 'administrator'
    or (
      public.current_theatreflow_role_text() = 'clinical_lead'
      and exists (
        select 1 from public.profile_specialty_access psa
        where psa.profile_id = auth.uid() and psa.specialty = target_specialty
      )
    );
$$;

create or replace function public.theatreflow_role_has_global_patient_access(role_name text)
returns boolean
language sql
immutable
as $$
  select role_name in ('administrator', 'service_manager', 'manager', 'consultant', 'read_only_auditor');
$$;

drop policy if exists "patients read" on public.patients;
create policy "patients read" on public.patients
for select using (
  auth.role() = 'authenticated'
  and (
    public.can_access_theatre(theatre_id)
    or public.can_access_specialty(specialty)
    or (theatre_id is null and public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','service_manager','manager'))
  )
);

drop policy if exists "workflow events read" on public.workflow_events;
create policy "workflow events read" on public.workflow_events
for select using (
  exists (
    select 1 from public.patients p
    where p.id = workflow_events.patient_id
      and (
        public.can_access_theatre(p.theatre_id)
        or public.can_access_specialty(p.specialty)
        or (p.theatre_id is null and public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','service_manager','manager'))
      )
  )
);

insert into public.theatreflow_schema_migrations (version, name)
values ('0011', 'Clinical lead specialty access and public operational views')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0011', 'Clinical leads can be assigned to specialties instead of theatres.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
