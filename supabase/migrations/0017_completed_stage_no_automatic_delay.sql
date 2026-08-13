begin;

-- Once a patient has left recovery their surgical pathway is complete, so the
-- completed stage must never accrue an automatic delay. Historical delay
-- events from earlier stages remain available for reporting and audit.
update public.workflow_stages
set delay_threshold_minutes = 0
where workflow_id = 'cepod-emergency-theatres'
  and id = 'patient-out-of-recovery';

insert into public.theatreflow_schema_migrations (version, name)
values ('0017', 'Disable automatic delay timing after recovery')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0017', 'Completed patients no longer accrue automatic delays after leaving recovery.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
