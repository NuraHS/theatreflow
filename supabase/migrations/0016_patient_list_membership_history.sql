begin;

-- Create an initial list-entry event for existing patients. A patient booked
-- directly for a future date starts on the planned list; a same-day booking
-- starts on CEPOD. Subsequent movement records then form a complete history.
insert into public.patient_list_movements (
  patient_id,
  from_operation_date,
  to_operation_date,
  moved_at,
  movement_type
)
select
  patient.id,
  null,
  coalesce(first_movement.from_operation_date, patient.operation_date, patient.created_at::date),
  coalesce(patient_insert.changed_at, patient.created_at),
  case
    when coalesce(first_movement.from_operation_date, patient.operation_date, patient.created_at::date) > coalesce(patient_insert.changed_at, patient.created_at)::date
      then 'to_planned'
    else 'to_cepod'
  end
from public.patients patient
left join lateral (
  select movement.from_operation_date
  from public.patient_list_movements movement
  where movement.patient_id = patient.id
  order by movement.moved_at asc
  limit 1
) first_movement on true
left join lateral (
  select audit.changed_at
  from public.audit_log audit
  where audit.table_name = 'patients'
    and audit.row_id = patient.id::text
    and audit.action = 'INSERT'
  order by audit.changed_at asc
  limit 1
) patient_insert on true
where not exists (
  select 1
  from public.patient_list_movements movement
  where movement.patient_id = patient.id
    and movement.from_operation_date is null
);

-- Keep the legacy cohort column accurate for reports that still read it.
update public.patients patient
set booking_cohort = case
  when exists (
    select 1
    from public.patient_list_movements movement
    where movement.patient_id = patient.id
      and movement.movement_type = 'to_planned'
      and movement.from_operation_date is not null
  ) then 'moved_to_planned'
  else 'booked'
end;

insert into public.theatreflow_schema_migrations (version, name)
values ('0016', 'Patient CEPOD and planned list membership history')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0016', 'Initial CEPOD or planned list entries were backfilled so historical daily list membership can be reconstructed.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
