const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
const patientId = '11111111-1111-4111-8111-111111111111';
const theatreId = '22222222-2222-4222-8222-222222222222';

function handler({ allowed = true, destination = true, conflict = false, sourceAllowed = true } = {}) {
  const writes = [];
  const supabase = { from: table => {
    let mutation = false;
    const query = {
      select() { return query; }, eq() { return query; }, is() { return query; },
      update(value) { mutation = true; writes.push(value); return query; },
      async maybeSingle() {
        if (table === 'theatres') return { data: destination ? { id: theatreId, suite_id: 'suite', default_recovery_area_id: 'new-recovery' } : null };
        if (table === 'theatre_suites') return { data: { id: 'suite' } };
        if (table === 'patients') return { data: mutation ? conflict ? null : { id: patientId } : { id: patientId, theatre_id: 'old-theatre' } };
        throw new Error('Unexpected database table');
      }
    };
    return query;
  } };
  const exports = {};
  const deps = {
    zod: require('zod'),
    'next/server': { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), options) } },
    '@/lib/services/access-control': { hasPermission: async () => allowed, canAccessPatient: async () => allowed, canAccessTheatre: async id => allowed && (id !== "old-theatre" || sourceAllowed) },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => supabase }
  };
  const code = ts.transpileModule(fs.readFileSync('app/api/patients/theatre/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => deps[name] });
  return { writes, call: (body = { patient_id: patientId, theatre_id: theatreId }) => exports.PATCH(new Request('http://localhost/api/patients/theatre', { method: 'PATCH', body: JSON.stringify(body) })) };
}

test('theatre correction updates only the location and matching recovery area', async () => {
  const api = handler();
  assert.equal((await api.call()).status, 200);
  assert.equal(JSON.stringify(api.writes), JSON.stringify([{ theatre_id: theatreId, recovery_area_id: 'new-recovery' }]));
});
test('unauthorised moves and unavailable destinations do not write anything', async () => {
  for (const [options, expected] of [[{ allowed: false }, 403], [{ destination: false }, 400], [{ sourceAllowed: false }, 403]]) {
    const api = handler(options);
    assert.equal((await api.call()).status, expected);
    assert.equal(api.writes.length, 0);
  }
});
test('invalid identifiers are rejected before a write', async () => {
  const api = handler();
  assert.equal((await api.call({ patient_id: 'invalid', theatre_id: theatreId })).status, 400);
  assert.equal(api.writes.length, 0);
});
test('a concurrent booking move produces a conflict rather than false success', async () => {
  assert.equal((await handler({ conflict: true }).call()).status, 409);
});
