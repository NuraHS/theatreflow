const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

process.env.TZ = 'Europe/London';
const exportsForTest = {};
const code = ts.transpileModule(fs.readFileSync('components/dashboards/dashboard-charts.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
// These tests exercise the chart's real date series; UI dependencies are unused.
vm.runInNewContext(code, { exports: exportsForTest, require: () => ({}) });
const { buildCaseSeries } = exportsForTest;
const range = (startKey, endKey) => ({ startKey, endKey, start: new Date(`${startKey}T00:00:00`), end: new Date(`${endKey}T23:59:59.999`) });
const patient = date => ({ operation_date: date, specialty: 'Synthetic specialty' });
const total = rows => rows.reduce((sum, row) => sum + (row['Synthetic specialty'] ?? 0), 0);

test('October remains 31 daily bars across the UK clock change, with compact labels and full tooltip dates', () => {
  const rows = buildCaseSeries([patient('2026-10-01'), patient('2026-10-31')], range('2026-10-01', '2026-10-31'));
  assert.equal(rows.length, 31);
  assert.equal(rows[0].label, '1');
  assert.equal(rows[30].label, '31');
  assert.equal(rows[30].tooltipDate, '31 October 2026');
  assert.equal(total(rows), 2);
});

test('a full year retains every weekly bar and case; only axis labels are shortened', () => {
  const rows = buildCaseSeries([patient('2026-01-01'), patient('2026-12-31')], range('2026-01-01', '2026-12-31'));
  assert.equal(rows.length, 53);
  assert.equal(total(rows), 2);
  assert.ok(rows.every(row => !row.label.includes('w/c')));
  assert.match(rows[0].tooltipDate, /Week commencing .*2025/);
  assert.match(rows.at(-1).tooltipDate, /Week commencing .*2026/);
});
