-- Preserve unavailable incident counts as NULL, rather than recording false zeroes.
begin;
alter table public.system_health_snapshots
  alter column critical_incidents_24h drop not null,
  alter column critical_incidents_24h drop default,
  alter column warnings_24h drop not null,
  alter column warnings_24h drop default;
insert into public.theatreflow_schema_migrations (version, name)
values ('0019', 'Preserve unknown monitoring counts')
on conflict (version) do update set name = excluded.name;
notify pgrst, 'reload schema';
commit;
