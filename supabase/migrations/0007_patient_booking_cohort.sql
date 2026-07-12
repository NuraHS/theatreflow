begin;

alter table public.patients
  add column if not exists booking_cohort text;

update public.patients
set booking_cohort = case
  when operation_date > created_at::date then 'moved_to_planned'
  else 'booked'
end
where booking_cohort is null;

-- Preserve known deferrals even when the patient has since returned to CEPOD.
do $$
begin
  if to_regclass('public.patient_list_movements') is not null then
    update public.patients p
    set booking_cohort = 'moved_to_planned'
    where exists (
      select 1 from public.patient_list_movements m
      where m.patient_id = p.id and m.movement_type = 'to_planned'
    );
  end if;
end $$;

alter table public.patients
  alter column booking_cohort set default 'booked',
  alter column booking_cohort set not null;

alter table public.patients drop constraint if exists patients_booking_cohort_check;
alter table public.patients
  add constraint patients_booking_cohort_check
  check (booking_cohort in ('booked', 'moved_to_planned'));

create index if not exists patients_booking_cohort_idx on public.patients(booking_cohort);

notify pgrst, 'reload schema';
commit;
