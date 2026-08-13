begin;

-- Timestamp corrections must retain the previous and amended values for the
-- clinical audit trail, not just audit newly inserted workflow events.
drop trigger if exists workflow_events_audit on public.workflow_events;
create trigger workflow_events_audit after insert or update on public.workflow_events
for each row execute function public.write_audit_log();

insert into public.theatreflow_schema_migrations (version, name)
values ('0014', 'Audited workflow timestamp corrections')
on conflict (version) do update set name = excluded.name;

insert into public.system_maintenance_events (event_type, status, version, notes)
select 'migration', 'success', '0014', 'Current-stage start times can be corrected with old and new values retained in the audit log.'
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'system_maintenance_events'
);

notify pgrst, 'reload schema';

commit;
