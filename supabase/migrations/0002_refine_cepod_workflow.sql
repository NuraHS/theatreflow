begin;

update public.workflow_stages
set display_order = display_order + 100
where workflow_id = 'cepod-emergency-theatres';

insert into public.workflow_stages (id, workflow_id, name, display_order, colour, delay_threshold_minutes, board_band)
values ('patient-on-list', 'cepod-emergency-theatres', 'Patient on list', 1, '#64748b', 30, 'Waiting')
on conflict (id) do update
set
  name = excluded.name,
  display_order = excluded.display_order,
  colour = excluded.colour,
  delay_threshold_minutes = excluded.delay_threshold_minutes,
  board_band = excluded.board_band;

update public.workflow_stages
set name = 'Patient Sent For', display_order = 2
where id = 'sent-for';

update public.workflow_stages
set name = 'Patient Arrived in Anaesthetic Room', display_order = 3
where id = 'patient-arrived';

update public.workflow_stages
set display_order = 4
where id = 'anaesthetic-started';

insert into public.workflow_stages (id, workflow_id, name, display_order, colour, delay_threshold_minutes, board_band)
values
  ('patient-in-theatre', 'cepod-emergency-theatres', 'Patient in Theatre', 50, '#0e7490', 15, 'Operating'),
  ('operation-started', 'cepod-emergency-theatres', 'Operation started', 51, '#dc2626', 120, 'Operating'),
  ('operation-finished', 'cepod-emergency-theatres', 'Operation finished', 52, '#ea580c', 20, 'Operating'),
  ('patient-in-recovery', 'cepod-emergency-theatres', 'Patient in Recovery', 53, '#16a34a', 30, 'Recovery'),
  ('patient-out-of-recovery', 'cepod-emergency-theatres', 'Patient out of Recovery', 54, '#15803d', 25, 'Ward')
on conflict (id) do update
set
  name = excluded.name,
  display_order = excluded.display_order,
  colour = excluded.colour,
  delay_threshold_minutes = excluded.delay_threshold_minutes,
  board_band = excluded.board_band;

update public.patients set current_stage = 'operation-started' where current_stage = 'knife-to-skin';
update public.patients set current_stage = 'operation-finished' where current_stage = 'procedure-finished';
update public.patients set current_stage = 'patient-in-recovery' where current_stage in ('out-of-theatre', 'recovery-ready');
update public.patients set current_stage = 'patient-out-of-recovery' where current_stage in ('left-recovery', 'returned-to-ward');
update public.patients set current_stage = 'patient-on-list' where current_stage = 'decision-to-operate';

update public.workflow_events set workflow_stage_id = 'operation-started' where workflow_stage_id = 'knife-to-skin';
update public.workflow_events set workflow_stage_id = 'operation-finished' where workflow_stage_id = 'procedure-finished';
update public.workflow_events set workflow_stage_id = 'patient-in-recovery' where workflow_stage_id in ('out-of-theatre', 'recovery-ready');
update public.workflow_events set workflow_stage_id = 'patient-out-of-recovery' where workflow_stage_id in ('left-recovery', 'returned-to-ward');
update public.workflow_events set workflow_stage_id = 'patient-on-list' where workflow_stage_id = 'decision-to-operate';

delete from public.workflow_stages
where id in ('decision-to-operate', 'knife-to-skin', 'procedure-finished', 'out-of-theatre', 'recovery-ready', 'left-recovery', 'returned-to-ward');

update public.workflow_stages set display_order = 5 where id = 'patient-in-theatre';
update public.workflow_stages set display_order = 6 where id = 'operation-started';
update public.workflow_stages set display_order = 7 where id = 'operation-finished';
update public.workflow_stages set display_order = 8 where id = 'patient-in-recovery';
update public.workflow_stages set display_order = 9 where id = 'patient-out-of-recovery';

update public.patients set cepod_priority = 'P1' where cepod_priority = 'Immediate';
update public.patients set cepod_priority = 'P2' where cepod_priority = 'Urgent';
update public.patients set cepod_priority = 'P3' where cepod_priority = 'Expedited';
update public.patients set cepod_priority = 'P4' where cepod_priority = 'Elective';

delete from public.priority_definitions;

insert into public.priority_definitions (id, label, target_minutes, colour)
values
  ('P1', 'P1', 30, '#dc2626'),
  ('P2', 'P2', 120, '#facc15'),
  ('P3', 'P3', 360, '#16a34a'),
  ('P4', 'P4', 1440, '#2563eb');

commit;
