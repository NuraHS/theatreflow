begin;

alter table public.patients
  add column if not exists unresolved boolean not null default false,
  add column if not exists unresolved_at timestamptz,
  add column if not exists unresolved_from_stage text,
  add column if not exists reconciliation_reviewed_at timestamptz;

create index if not exists patients_unresolved_idx
  on public.patients(unresolved)
  where unresolved = true;

comment on column public.patients.unresolved is
  'True when a patient has exceeded the stage reconciliation threshold and requires an explicit staff review.';

comment on column public.patients.unresolved_at is
  'Timestamp at which the current stalled stage crossed its unresolved threshold.';

comment on column public.patients.unresolved_from_stage is
  'Workflow stage held when the patient became unresolved.';

comment on column public.patients.reconciliation_reviewed_at is
  'Most recent staff confirmation that the patient remains active in the current stage; starts a fresh threshold window.';

notify pgrst, 'reload schema';

commit;
