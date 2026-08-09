begin;

-- Some early Theatreflow installations were created with the repair/setup script,
-- which did not include the authentication profile objects from migration 0001.
-- Keep this migration self-contained so it can be applied safely to either shape.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'theatre_staff',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists created_at timestamptz not null default now();

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

create or replace function public.current_theatreflow_role_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()), 'theatre_staff');
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

create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  component text not null check (component in ('application','database','authentication','storage','backup','network','certificate','update','other')),
  severity text not null check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','monitoring','resolved')),
  summary text not null check (char_length(summary) between 3 and 200),
  details text,
  resolution_notes text,
  resolved_at timestamptz,
  recorded_by uuid references auth.users(id)
);

create table if not exists public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  overall_status text not null check (overall_status in ('healthy','warning','critical','unknown')),
  application_status text not null check (application_status in ('healthy','warning','critical','unknown')),
  database_status text not null check (database_status in ('healthy','warning','critical','unknown')),
  authentication_status text not null check (authentication_status in ('healthy','warning','critical','unknown')),
  storage_status text not null check (storage_status in ('healthy','warning','critical','unknown')),
  database_size_bytes bigint,
  storage_total_bytes bigint,
  storage_used_bytes bigint,
  app_version text not null,
  critical_incidents_24h integer not null default 0,
  warnings_24h integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.system_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('backup','restore','migration','update','certificate','maintenance')),
  status text not null check (status in ('success','warning','failed')),
  occurred_at timestamptz not null default now(),
  version text,
  notes text,
  recorded_by uuid references auth.users(id)
);

create table if not exists public.theatreflow_schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);

create index if not exists system_incidents_occurred_at_idx on public.system_incidents(occurred_at desc);
create index if not exists system_incidents_open_idx on public.system_incidents(status) where status <> 'resolved';
create index if not exists system_health_snapshots_checked_at_idx on public.system_health_snapshots(checked_at desc);
create index if not exists system_maintenance_events_occurred_at_idx on public.system_maintenance_events(occurred_at desc);

alter table public.system_incidents enable row level security;
alter table public.system_health_snapshots enable row level security;
alter table public.system_maintenance_events enable row level security;
alter table public.theatreflow_schema_migrations enable row level security;

drop policy if exists "system incidents admin read" on public.system_incidents;
drop policy if exists "system incidents admin write" on public.system_incidents;
drop policy if exists "system snapshots admin read" on public.system_health_snapshots;
drop policy if exists "system snapshots admin insert" on public.system_health_snapshots;
drop policy if exists "system maintenance admin read" on public.system_maintenance_events;
drop policy if exists "system maintenance admin write" on public.system_maintenance_events;
drop policy if exists "schema migrations admin read" on public.theatreflow_schema_migrations;

create policy "system incidents admin read" on public.system_incidents
for select using (public.is_theatreflow_administrator());
create policy "system incidents admin write" on public.system_incidents
for all using (public.is_theatreflow_administrator())
with check (public.is_theatreflow_administrator());

create policy "system snapshots admin read" on public.system_health_snapshots
for select using (public.is_theatreflow_administrator());
create policy "system snapshots admin insert" on public.system_health_snapshots
for insert with check (public.is_theatreflow_administrator());

create policy "system maintenance admin read" on public.system_maintenance_events
for select using (public.is_theatreflow_administrator());
create policy "system maintenance admin write" on public.system_maintenance_events
for all using (public.is_theatreflow_administrator())
with check (public.is_theatreflow_administrator());

create policy "schema migrations admin read" on public.theatreflow_schema_migrations
for select using (public.is_theatreflow_administrator());

create or replace function public.get_theatreflow_database_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'database_size_bytes', pg_database_size(current_database()),
    'connection_count', (select count(*) from pg_stat_activity where datname = current_database()),
    'max_connections', current_setting('max_connections')::integer
  );
$$;

revoke all on function public.get_theatreflow_database_metrics() from public;
grant execute on function public.get_theatreflow_database_metrics() to authenticated, service_role;

drop trigger if exists system_incidents_audit on public.system_incidents;
create trigger system_incidents_audit after insert or update on public.system_incidents
for each row execute function public.write_audit_log();

drop trigger if exists system_maintenance_events_audit on public.system_maintenance_events;
create trigger system_maintenance_events_audit after insert or update on public.system_maintenance_events
for each row execute function public.write_audit_log();

insert into public.theatreflow_schema_migrations (version, name)
values ('0009', 'System health monitoring and technical incident audit')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
values ('migration', 'success', '0009', 'System health monitoring schema installed.');

notify pgrst, 'reload schema';

commit;
