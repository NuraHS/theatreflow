begin;

-- A patient may legitimately remain on the CEPOD list while an earlier case is
-- in progress. Zero disables automatic delay escalation for this stage; staff
-- can still record a delay reason when the patient is sent for.
update public.workflow_stages
set delay_threshold_minutes = 0
where id = 'patient-on-list'
  and workflow_id = 'cepod-emergency-theatres';

insert into public.theatreflow_schema_migrations (version, name)
values ('0012', 'Disable automatic delay timing while waiting for surgery')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0012', 'Waiting-list patients have no automatic delay threshold; manual send-for delay reasons remain available.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
