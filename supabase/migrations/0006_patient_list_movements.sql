begin;

-- This migration deliberately uses Supabase's built-in authenticated role.
-- Some Theatreflow databases were installed with setup_theatreflow.sql and do
-- not have the optional public.user_role enum or public.profiles table.

create table if not exists public.patient_list_movements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  from_operation_date date,
  to_operation_date date not null,
  moved_at timestamptz not null default now(),
  movement_type text not null check (movement_type in ('to_cepod', 'to_planned', 'rescheduled')),
  user_id uuid references auth.users(id)
);

create index if not exists patient_list_movements_patient_idx on public.patient_list_movements(patient_id, moved_at desc);
create index if not exists patient_list_movements_moved_at_idx on public.patient_list_movements(moved_at desc);

alter table public.patient_list_movements enable row level security;

drop policy if exists "list movements read" on public.patient_list_movements;
drop policy if exists "list movements insert" on public.patient_list_movements;

create policy "list movements read"
on public.patient_list_movements
for select
to authenticated
using (true);

create policy "list movements insert"
on public.patient_list_movements
for insert
to authenticated
with check (auth.uid() is not null);

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

drop trigger if exists patient_list_movements_audit on public.patient_list_movements;
create trigger patient_list_movements_audit
after insert on public.patient_list_movements
for each row execute function public.write_audit_log();

commit;
