begin;

-- Anaesthesia and surgery may take as long as clinically required. A zero
-- threshold disables automatic escalation while retaining manual delay capture.
update public.workflow_stages
set delay_threshold_minutes = 0
where workflow_id = 'cepod-emergency-theatres'
  and id in ('anaesthetic-started', 'operation-started');

insert into public.theatreflow_schema_migrations (version, name)
values ('0013', 'Disable automatic delay timing during anaesthesia and surgery')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0013', 'Anaesthetic Started and Operation Started have no automatic delay threshold; manual delay reasons remain available.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
