begin;

alter table public.patients
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

update public.patients p
set completed_at = coalesce(
  p.completed_at,
  (select max(e.timestamp) from public.workflow_events e
   where e.patient_id = p.id and e.workflow_stage_id = 'patient-out-of-recovery')
)
where p.current_stage = 'patient-out-of-recovery';

create index if not exists patients_completed_at_idx on public.patients(completed_at desc);
create index if not exists patients_cancelled_at_idx on public.patients(cancelled_at desc);

commit;
