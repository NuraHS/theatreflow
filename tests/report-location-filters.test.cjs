const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function renderReport(selection) {
  const output = { rows: [], blobs: [], pdfRows: [] };
  const element = (type, props) => ({ type, props });
  const react = { useState: initial => [initial === null ? selection : initial, () => {}], useMemo: fn => fn() };
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    '@tanstack/react-table': {
      getCoreRowModel: () => ({}), flexRender: () => null,
      useReactTable: ({ data }) => { output.rows = data; return { getHeaderGroups: () => [], getRowModel: () => ({ rows: [] }) }; }
    },
    'lucide-react': { CalendarDays: 'icon', Download: 'icon', FilterX: 'icon' },
    jspdf: class { text() {} save() {} },
    'jspdf-autotable': (_, options) => { output.pdfRows = options.body; },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/card': { Card: 'card', CardContent: 'content', CardHeader: 'header', CardTitle: 'title' },
    '@/components/ui/input': { Input: 'input' }, '@/components/ui/select': { Select: 'select' }
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('components/reports/patient-report-table.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(code, {
    exports, Blob,
    URL: { createObjectURL: blob => { output.blobs.push(blob); return 'blob:test'; }, revokeObjectURL: () => {} },
    document: { createElement: () => ({ click() {} }) },
    require: name => { if (Object.hasOwn(dependencies, name)) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`); }
  });
  const timestamp = new Date().toISOString();
  const patients = [
    { id: 'p1', theatre_id: 'a2-1', hospital_number: 'SYNTHETIC-A2' },
    { id: 'p2', theatre_id: 'epsom-1', hospital_number: 'SYNTHETIC-EPSOM' },
    { id: 'p3', theatre_id: null, hospital_number: 'SYNTHETIC-UNASSIGNED' }
  ].map(patient => ({ ...patient, created_at: timestamp, specialty: 'Urology', procedure: 'Synthetic procedure', consultant: 'Synthetic consultant', cepod_priority: 'P2', current_stage: 'patient-on-list' }));
  const tree = exports.PatientReportTable({ patients, events: [], delayReasons: [], theatreConfiguration: {
    suites: [{ id: 'a2', name: 'St Helier A2 Theatres' }, { id: 'epsom', name: 'Epsom Main Theatres' }],
    theatres: [{ id: 'a2-1', suite_id: 'a2', name: 'CEPOD Theatre 1' }, { id: 'epsom-1', suite_id: 'epsom', name: 'Theatre 1' }], recovery_areas: []
  } });
  const buttons = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'button') buttons.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  output.export = format => {
    const button = buttons.find(node => Array.isArray(node.props.children) && node.props.children.includes(format));
    assert.ok(button, `Export button ${format} exists`);
    button.props.onClick();
  };
  return output;
}

test('location selection filters the preview and every export to the same theatre', async () => {
  const report = renderReport(['epsom-1']);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].hospitalNumber, 'SYNTHETIC-EPSOM');
  report.export('CSV'); report.export('Excel'); report.export('PDF');
  for (const blob of report.blobs) {
    const contents = await blob.text();
    assert.match(contents, /SYNTHETIC-EPSOM/);
    assert.match(contents, /Epsom Main Theatres/);
    assert.doesNotMatch(contents, /SYNTHETIC-A2|SYNTHETIC-UNASSIGNED/);
  }
  assert.equal(report.pdfRows.length, 1);
  assert.equal(report.pdfRows[0][0], 'Epsom Main Theatres');
  assert.equal(report.pdfRows[0][2], 'SYNTHETIC-EPSOM');
});

test('all locations retains unassigned cases; clearing locations returns no rows', () => {
  assert.equal(renderReport(null).rows.length, 3);
  assert.equal(renderReport([]).rows.length, 0);
  assert.equal(renderReport(['other']).rows[0].hospitalNumber, 'SYNTHETIC-UNASSIGNED');
  assert.equal(renderReport(['a2-1', 'epsom-1']).rows.length, 2);
});
