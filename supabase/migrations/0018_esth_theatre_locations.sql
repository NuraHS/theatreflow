-- Replace the original demonstration locations with ESTH locations.
-- Keep existing suite/theatre IDs so patient and access references remain valid.
-- Legacy mapping: St James' -> Epsom Main; Atkinson Morley -> A2; Gynae -> B4.
-- B4 Theatre 3 is retired, not deleted, to retain historical patient references.
begin;

update public.theatre_suites s
set code = m.new_code, name = m.new_name, display_order = m.sort_order
from (values
  ('st-james', 'epsom-main', 'Epsom Main Theatres', 3),
  ('atkinson-morley', 'st-helier-a2', 'St Helier A2 Theatres', 1),
  ('gynae', 'st-helier-b4', 'B4 Theatres', 2)
) as m(old_code, new_code, new_name, sort_order)
where s.code = m.old_code;

update public.recovery_areas r
set code = s.code || '-recovery', name = m.recovery_name
from public.theatre_suites s
join (values
  ('epsom-main', 'Epsom Main Recovery'),
  ('st-helier-a2', 'St Helier A2 Recovery'),
  ('st-helier-b4', 'B4 Recovery')
) as m(suite_code, recovery_name) on s.code = m.suite_code
where r.suite_id = s.id
  and r.code in ('st-james-recovery', 'atkinson-morley-recovery', 'gynae-recovery');

update public.theatres t
set code = s.code || '-theatre-' || t.display_order::text,
    name = case
      when s.code = 'st-helier-a2' and t.display_order = 1 then 'CEPOD Theatre 1'
      when s.code = 'st-helier-a2' and t.display_order = 3 then 'Trauma Theatre 3'
      else 'Theatre ' || t.display_order::text
    end,
    active = not (s.code = 'st-helier-b4' and t.display_order > 2)
from public.theatre_suites s
where t.suite_id = s.id
  and s.code in ('epsom-main', 'st-helier-a2', 'st-helier-b4')
  and t.code ~ '^(st-james|atkinson-morley|gynae)-theatre-[0-9]+$';

commit;
