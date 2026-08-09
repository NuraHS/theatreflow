-- Authentication profiles, role-based access, theatre suites and recovery areas.
-- Run after 0009_system_health_monitoring.sql.

-- Expand the original enum when migration 0001 created it. Installations created
-- from setup_theatreflow.sql use a text role column and do not need this step.
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    alter type public.user_role add value if not exists 'theatre_coordinator';
    alter type public.user_role add value if not exists 'service_manager';
    alter type public.user_role add value if not exists 'theatre_manager';
    alter type public.user_role add value if not exists 'divisional_leadership';
  end if;
end
$$;

begin;

create table if not exists public.theatre_suites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_areas (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.theatre_suites(id) on delete restrict,
  code text not null unique,
  name text not null,
  capacity integer,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (suite_id, name)
);

create table if not exists public.theatres (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.theatre_suites(id) on delete restrict,
  default_recovery_area_id uuid references public.recovery_areas(id) on delete set null,
  code text not null unique,
  name text not null,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (suite_id, name)
);

insert into public.theatre_suites (id, code, name, display_order)
values
  ('11111111-1111-4111-8111-111111111101', 'st-james', 'St James''', 1),
  ('11111111-1111-4111-8111-111111111102', 'atkinson-morley', 'Atkinson Morley', 2),
  ('11111111-1111-4111-8111-111111111103', 'gynae', 'Gynae', 3)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  active = true,
  display_order = excluded.display_order;

insert into public.recovery_areas (id, suite_id, code, name, capacity, display_order)
values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'st-james-recovery', 'St James'' Recovery', 8, 1),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102', 'atkinson-morley-recovery', 'Atkinson Morley Recovery', 6, 1),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111103', 'gynae-recovery', 'Gynae Recovery', 6, 1)
on conflict (id) do update set
  suite_id = excluded.suite_id,
  code = excluded.code,
  name = excluded.name,
  capacity = excluded.capacity,
  active = true,
  display_order = excluded.display_order;

insert into public.theatres (id, suite_id, default_recovery_area_id, code, name, display_order)
values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', 'st-james-theatre-1', 'Theatre 1', 1),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', 'st-james-theatre-2', 'Theatre 2', 2),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', 'st-james-theatre-3', 'Theatre 3', 3),
  ('33333333-3333-4333-8333-333333333304', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', 'st-james-theatre-4', 'Theatre 4', 4),
  ('33333333-3333-4333-8333-333333333305', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', 'st-james-theatre-5', 'Theatre 5', 5),
  ('33333333-3333-4333-8333-333333333306', '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202', 'atkinson-morley-theatre-1', 'Theatre 1', 1),
  ('33333333-3333-4333-8333-333333333307', '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202', 'atkinson-morley-theatre-2', 'Theatre 2', 2),
  ('33333333-3333-4333-8333-333333333308', '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202', 'atkinson-morley-theatre-3', 'Theatre 3', 3),
  ('33333333-3333-4333-8333-333333333309', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222203', 'gynae-theatre-1', 'Theatre 1', 1),
  ('33333333-3333-4333-8333-333333333310', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222203', 'gynae-theatre-2', 'Theatre 2', 2),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222203', 'gynae-theatre-3', 'Theatre 3', 3)
on conflict (id) do update set
  suite_id = excluded.suite_id,
  default_recovery_area_id = excluded.default_recovery_area_id,
  code = excluded.code,
  name = excluded.name,
  active = true,
  display_order = excluded.display_order;

alter table public.profiles
  add column if not exists email text,
  add column if not exists job_title text,
  add column if not exists active boolean not null default true,
  add column if not exists primary_suite_id uuid references public.theatre_suites(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role::text in (
    'theatre_staff', 'theatre_coordinator', 'service_manager',
    'clinical_lead', 'theatre_manager', 'divisional_leadership',
    'administrator', 'manager', 'consultant', 'read_only_auditor'
  )
);

create table if not exists public.profile_suite_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  suite_id uuid not null references public.theatre_suites(id) on delete cascade,
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, suite_id)
);

create table if not exists public.profile_theatre_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, theatre_id)
);

alter table public.patients
  add column if not exists theatre_id uuid references public.theatres(id) on delete restrict,
  add column if not exists recovery_area_id uuid references public.recovery_areas(id) on delete restrict;

update public.patients p
set recovery_area_id = t.default_recovery_area_id
from public.theatres t
where p.theatre_id = t.id and p.recovery_area_id is null;

create index if not exists patients_theatre_id_idx on public.patients(theatre_id);
create index if not exists patients_recovery_area_id_idx on public.patients(recovery_area_id);
create index if not exists theatres_suite_id_idx on public.theatres(suite_id);
create index if not exists recovery_areas_suite_id_idx on public.recovery_areas(suite_id);

create or replace function public.current_theatreflow_role_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role::text from public.profiles where id = auth.uid() and active), 'theatre_staff');
$$;

create or replace function public.is_theatreflow_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_theatreflow_role_text() = 'administrator';
$$;

create or replace function public.theatreflow_role_has_global_patient_access(role_name text)
returns boolean
language sql
immutable
as $$
  select role_name in ('administrator', 'service_manager', 'clinical_lead', 'manager', 'consultant', 'read_only_auditor');
$$;

create or replace function public.can_access_theatre_suite(target_suite_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.theatreflow_role_has_global_patient_access(public.current_theatreflow_role_text())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active and p.primary_suite_id = target_suite_id
    )
    or exists (
      select 1 from public.profile_suite_access psa
      where psa.profile_id = auth.uid() and psa.suite_id = target_suite_id
    )
    or exists (
      select 1
      from public.profile_theatre_access pta
      join public.theatres t on t.id = pta.theatre_id
      where pta.profile_id = auth.uid() and t.suite_id = target_suite_id
    );
$$;

create or replace function public.can_access_theatre(target_theatre_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.theatreflow_role_has_global_patient_access(public.current_theatreflow_role_text())
    or exists (
      select 1 from public.profile_theatre_access pta
      where pta.profile_id = auth.uid() and pta.theatre_id = target_theatre_id
    )
    or exists (
      select 1
      from public.theatres t
      where t.id = target_theatre_id
        and public.current_theatreflow_role_text() in ('theatre_coordinator', 'theatre_manager')
        and public.can_access_theatre_suite(t.suite_id)
    );
$$;

create or replace function public.can_access_recovery_area(target_recovery_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recovery_areas r
    where r.id = target_recovery_area_id and public.can_access_theatre_suite(r.suite_id)
  );
$$;

create or replace function public.handle_new_theatreflow_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'New user'), '@', 1)),
    'theatre_staff'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_theatreflow on auth.users;
create trigger on_auth_user_created_theatreflow
after insert or update of email on auth.users
for each row execute function public.handle_new_theatreflow_user();

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, 'Existing user'), '@', 1)),
  'theatre_staff'
from auth.users u
on conflict (id) do update set email = excluded.email;

alter table public.theatre_suites enable row level security;
alter table public.theatres enable row level security;
alter table public.recovery_areas enable row level security;
alter table public.profile_suite_access enable row level security;
alter table public.profile_theatre_access enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles admin write" on public.profiles;
drop policy if exists "theatre suites scoped read" on public.theatre_suites;
drop policy if exists "theatres scoped read" on public.theatres;
drop policy if exists "recovery areas scoped read" on public.recovery_areas;
drop policy if exists "theatre locations admin write" on public.theatre_suites;
drop policy if exists "theatres admin write" on public.theatres;
drop policy if exists "recovery areas admin write" on public.recovery_areas;
drop policy if exists "suite access self read" on public.profile_suite_access;
drop policy if exists "suite access admin write" on public.profile_suite_access;
drop policy if exists "theatre access self read" on public.profile_theatre_access;
drop policy if exists "theatre access admin write" on public.profile_theatre_access;

create policy "profiles self read" on public.profiles
for select using (id = auth.uid() or public.is_theatreflow_administrator());
create policy "profiles admin write" on public.profiles
for all using (public.is_theatreflow_administrator()) with check (public.is_theatreflow_administrator());

create policy "theatre suites scoped read" on public.theatre_suites
for select using (public.can_access_theatre_suite(id));
create policy "theatres scoped read" on public.theatres
for select using (public.can_access_theatre(id));
create policy "recovery areas scoped read" on public.recovery_areas
for select using (public.can_access_recovery_area(id));

create policy "theatre locations admin write" on public.theatre_suites
for all using (public.is_theatreflow_administrator()) with check (public.is_theatreflow_administrator());
create policy "theatres admin write" on public.theatres
for all using (public.is_theatreflow_administrator()) with check (public.is_theatreflow_administrator());
create policy "recovery areas admin write" on public.recovery_areas
for all using (public.is_theatreflow_administrator()) with check (public.is_theatreflow_administrator());

create policy "suite access self read" on public.profile_suite_access
for select using (profile_id = auth.uid() or public.is_theatreflow_administrator());
create policy "suite access admin write" on public.profile_suite_access
for all using (public.is_theatreflow_administrator()) with check (public.is_theatreflow_administrator());
create policy "theatre access self read" on public.profile_theatre_access
for select using (profile_id = auth.uid() or public.is_theatreflow_administrator());
create policy "theatre access admin write" on public.profile_theatre_access
for all using (public.is_theatreflow_administrator()) with check (public.is_theatreflow_administrator());

drop policy if exists "patients read" on public.patients;
drop policy if exists "patients write" on public.patients;
drop policy if exists "patients update" on public.patients;
create policy "patients read" on public.patients
for select using (
  auth.role() = 'authenticated'
  and (
    public.can_access_theatre(theatre_id)
    or (theatre_id is null and public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','service_manager','clinical_lead','manager'))
  )
);
create policy "patients write" on public.patients
for insert with check (
  public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','theatre_staff','manager','clinical_lead','consultant')
  and (theatre_id is null or public.can_access_theatre(theatre_id))
);
create policy "patients update" on public.patients
for update using (
  public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','theatre_staff','manager','clinical_lead','consultant')
  and (theatre_id is null or public.can_access_theatre(theatre_id))
) with check (theatre_id is null or public.can_access_theatre(theatre_id));

drop policy if exists "workflow events read" on public.workflow_events;
drop policy if exists "workflow events insert" on public.workflow_events;
create policy "workflow events read" on public.workflow_events
for select using (
  exists (
    select 1 from public.patients p
    where p.id = workflow_events.patient_id
      and (
        public.can_access_theatre(p.theatre_id)
        or (p.theatre_id is null and public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','service_manager','clinical_lead','manager'))
      )
  )
);
create policy "workflow events insert" on public.workflow_events
for insert with check (
  public.current_theatreflow_role_text() in ('administrator','theatre_manager','theatre_coordinator','theatre_staff','manager','clinical_lead','consultant')
  and exists (
    select 1 from public.patients p
    where p.id = workflow_events.patient_id
      and (p.theatre_id is null or public.can_access_theatre(p.theatre_id))
  )
);

create table if not exists public.theatreflow_schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);

insert into public.theatreflow_schema_migrations (version, name)
values ('0010', 'Authentication roles, theatre suites and recovery access')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0010', 'Role-based access and theatre location schema installed.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
