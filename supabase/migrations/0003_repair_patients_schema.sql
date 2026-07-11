begin;

alter table public.patients
  add column if not exists patient_name text,
  add column if not exists consultant text,
  add column if not exists specialty text,
  add column if not exists procedure text,
  add column if not exists procedure_name text,
  add column if not exists cepod_priority text,
  add column if not exists current_stage text,
  add column if not exists cancelled boolean not null default false,
  add column if not exists cancellation_reason text,
  add column if not exists workflow_id text;

update public.patients
set
  consultant = coalesce(consultant, 'Not recorded'),
  specialty = coalesce(specialty, 'Not recorded'),
  procedure = coalesce(procedure, procedure_name, 'Not recorded'),
  procedure_name = coalesce(procedure_name, procedure, 'Not recorded'),
  cepod_priority = coalesce(cepod_priority, 'P2'),
  current_stage = coalesce(current_stage, 'patient-on-list'),
  workflow_id = coalesce(workflow_id, 'cepod-emergency-theatres');

alter table public.patients
  alter column consultant set not null,
  alter column specialty set not null,
  alter column procedure set not null,
  alter column procedure_name set not null,
  alter column cepod_priority set not null,
  alter column current_stage set not null,
  alter column workflow_id set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'patients'
      and constraint_name = 'patients_current_stage_fkey'
  ) then
    alter table public.patients
      add constraint patients_current_stage_fkey
      foreign key (current_stage)
      references public.workflow_stages(id);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'patients'
      and constraint_name = 'patients_workflow_id_fkey'
  ) then
    alter table public.patients
      add constraint patients_workflow_id_fkey
      foreign key (workflow_id)
      references public.workflows(id);
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
