const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
process.env.TZ = 'Europe/London';
const helpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/utils/patient-list.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: helpers, Date });
const { isPatientDueForTheatreList, selectLiveBoardPatients } = helpers;
const booking = (id, overrides = {}) => ({ id, created_at: '2026-10-25T09:00:00Z', operation_date: '2026-10-25', cancelled: false, current_stage: 'patient-on-list', ...overrides });

test('two-day-old waiting cases remain on the Live Board alongside new bookings', () => {
  const patients = [booking('carryover'), booking('new', { operation_date: '2026-10-27', created_at: '2026-10-27T08:00:00Z' }), booking('planned', { operation_date: '2026-10-28' }), booking('cancelled', { cancelled: true })];
  const result = selectLiveBoardPatients(patients, new Date('2026-10-27T10:00:00Z'));
  assert.equal(result.map(patient => patient.id).join(','), 'carryover,new');
});
test('completed carryovers appear only on the day of completion', () => {
  const result = selectLiveBoardPatients([
    booking('old-completion', { current_stage: 'patient-out-of-recovery', completed_at: '2026-10-26T12:00:00Z' }),
    booking('completed-today', { current_stage: 'patient-out-of-recovery', completed_at: '2026-10-27T09:00:00Z' })
  ], new Date('2026-10-27T10:00:00Z'));
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'completed-today');
});
test('planned rollover matches the theatre list at 07:00; carryovers are not held back', () => {
  const dueToday = booking('planned-today', { operation_date: '2026-10-27' });
  assert.equal(isPatientDueForTheatreList(dueToday, new Date('2026-10-27T06:59:00Z')), false);
  assert.equal(isPatientDueForTheatreList(dueToday, new Date('2026-10-27T07:00:00Z')), true);
  assert.equal(isPatientDueForTheatreList(booking('carryover'), new Date('2026-10-27T06:00:00Z')), true);
});
test('older records without an operation date and unresolved cases are retained for review', () => {
  const result = selectLiveBoardPatients([booking('legacy', { operation_date: null }), booking('review', { unresolved: true, current_stage: 'operation-started' })], new Date('2026-10-27T10:00:00Z'));
  assert.equal(result.length, 2);
});
