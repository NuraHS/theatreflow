begin;

alter table public.patients
  add column if not exists operation_date date;

update public.patients
set operation_date = created_at::date
where operation_date is null;

alter table public.patients
  alter column operation_date set not null,
  alter column operation_date set default current_date;

notify pgrst, 'reload schema';

commit;
