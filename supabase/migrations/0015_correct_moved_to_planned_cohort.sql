begin;

-- A future operation date can be a direct planned booking. Only an audited
-- to_planned movement proves that a patient was moved from the CEPOD list.
do $$
begin
  if to_regclass('public.patient_list_movements') is not null then
    update public.patients p
    set booking_cohort = case
      when exists (
        select 1
        from public.patient_list_movements movement
        where movement.patient_id = p.id
          and movement.movement_type = 'to_planned'
          and movement.from_operation_date is not null
      ) then 'moved_to_planned'
      else 'booked'
    end;
  end if;
end $$;

insert into public.theatreflow_schema_migrations (version, name)
values ('0015', 'Correct moved-to-planned cohort from audited list movements')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0015', 'Direct future bookings are distinguished from patients actually moved from CEPOD to a planned list.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
