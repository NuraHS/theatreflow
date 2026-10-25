const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function loadTs(path, environment = {}, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: environment, version: 'test', uptime: () => 0, memoryUsage: () => ({ rss: 0 }) }, performance, require: (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

const { connectionFailure } = loadTs('lib/services/health-diagnostics.ts');

test('credential failures provide configuration guidance without leaking provider text', () => {
  const result = connectionFailure({ message: 'secret-token https://private.example', status: 401 });
  assert.equal(result.status, 'critical');
  assert.match(result.detail, /credentials/);
  assert.doesNotMatch(result.detail, /secret-token|private.example/);
});

test('missing schema is distinguished from an outage', () => {
  const result = connectionFailure({ code: 'PGRST205' });
  assert.equal(result.status, 'warning');
  assert.match(result.detail, /migrations/);
});

test('paused projects and DNS failures have different next steps', () => {
  assert.match(connectionFailure({}, 540).detail, /Resume/);
  assert.match(connectionFailure({ details: 'getaddrinfo ENOTFOUND private.host' }).detail, /could not be resolved/);
  assert.match(connectionFailure({ message: 'fetch failed' }).detail, /could not reach/);
});

test('cloud storage never reads the application filesystem, even with a configured path', async () => {
  const environment = { VERCEL: '1', THEATREFLOW_STORAGE_PATH: '/app', THEATREFLOW_DEPLOYMENT_MODE: 'on-premises' };
  const diagnostics = loadTs('lib/services/health-diagnostics.ts', environment);
  const service = loadTs('lib/services/system-health.ts', environment, {
    'server-only': {},
    'node:fs/promises': { statfs: () => { throw new Error('Must not inspect Vercel disk'); } },
    '@/package.json': { version: 'test' },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => null },
    '@/lib/services/health-diagnostics': diagnostics
  });
  const report = await service.getSystemHealthReport();
  assert.equal(report.storage.utilisation_percent, null);
  assert.equal(report.storage.total_bytes, null);
  assert.equal(report.storage.status, 'unknown');
  assert.equal(report.deployment_mode, 'Cloud hosting / Supabase');
  assert.match(report.checks.find(check => check.id === 'certificate').summary, /managed/);
});

test('configured on-premises data volumes still report genuine capacity alerts', async () => {
  const environment = { THEATREFLOW_STORAGE_PATH: '/data' };
  const diagnostics = loadTs('lib/services/health-diagnostics.ts', environment);
  const service = loadTs('lib/services/system-health.ts', environment, {
    'server-only': {},
    'node:fs/promises': { statfs: async path => {
      assert.equal(path, '/data');
      return { blocks: 100, bsize: 1024, bavail: 3 };
    } },
    '@/package.json': { version: 'test' },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => null },
    '@/lib/services/health-diagnostics': diagnostics
  });
  const report = await service.getSystemHealthReport();
  assert.equal(report.storage.utilisation_percent, 97);
  assert.equal(report.storage.status, 'critical');
  assert.equal(report.overall_status, 'critical');
});

test('an authentication credential failure remains critical when the database responds', async () => {
  const environment = { VERCEL: '1' };
  const diagnostics = loadTs('lib/services/health-diagnostics.ts', environment);
  const query = new Proxy({}, { get: (_, key) => key === 'then' ? resolve => resolve({ error: null, count: 0, data: null }) : () => query });
  const service = loadTs('lib/services/system-health.ts', environment, {
    'server-only': {},
    'node:fs/promises': {},
    '@/package.json': { version: 'test' },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => ({
      from: () => query,
      rpc: async () => ({ data: null }),
      auth: { admin: { listUsers: async () => ({ error: { status: 401, message: 'private-provider-error' } }) } }
    }) },
    '@/lib/services/health-diagnostics': diagnostics
  });
  const report = await service.getSystemHealthReport();
  assert.equal(report.database.status, 'healthy');
  assert.equal(report.authentication.status, 'critical');
  assert.equal(report.overall_status, 'critical');
  assert.match(report.checks.find(check => check.id === 'authentication').detail, /credentials/);
  assert.doesNotMatch(JSON.stringify(report), /private-provider-error/);
});

function accessModule(profile) {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'test-user', email: 'test@example.invalid' } } }) },
    from: table => ({ select: () => ({ eq: () => table === 'profiles'
      ? { maybeSingle: async () => ({ data: profile }) }
      : Promise.resolve({ data: [] }) }) })
  };
  return loadTs('lib/services/access-control.ts', {}, {
    'server-only': {}, 'next/navigation': { redirect: () => { throw new Error('Unexpected redirect'); } },
    '@/lib/constants/permissions': { can: () => false },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => client, createServiceRoleSupabaseClient: () => client }
  });
}

test('a real login is retained even when role enforcement is disabled', async () => {
  const access = await accessModule({ role: 'administrator', active: true, full_name: 'Test admin' }).getCurrentUserAccess();
  assert.equal(access.id, 'test-user');
  assert.equal(access.authenticated, true);
  assert.equal(access.full_name, 'Test admin');
});

test('a missing access profile is not treated as active', async () => {
  assert.equal((await accessModule(null).getCurrentUserAccess()).active, false);
});

test('unavailable incident counts remain unknown, not zero', async () => {
  const diagnostics = loadTs('lib/services/health-diagnostics.ts');
  const service = loadTs('lib/services/system-health.ts', {}, {
    'server-only': {}, 'node:fs/promises': {}, '@/package.json': { version: '0.1.0' },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => null }, '@/lib/services/health-diagnostics': diagnostics
  });
  const report = await service.getSystemHealthReport();
  assert.equal(report.activity.open_incidents, null);
  assert.equal(report.activity.critical_incidents_24h, null);
  assert.equal(report.activity.status, 'unknown');
  assert.equal(report.configuration.source, 'demo-fallback');
  assert.equal(report.role_permissions_enforced, false);
});

test('structured support exports omit free text, identities and historical details', async () => {
  const diagnostics = loadTs('lib/services/health-diagnostics.ts');
  const service = loadTs('lib/services/system-health.ts', {}, {
    'server-only': {}, 'node:fs/promises': {}, '@/package.json': { version: '0.1.0' },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => null }, '@/lib/services/health-diagnostics': diagnostics
  });
  const report = await service.getSystemHealthReport();
  const helpers = loadTs('lib/services/support-bundle-data.ts');
  const marker = 'PRIVATE_PATIENT_OR_SECRET';
  report.migration.name = marker;
  report.configuration.unexpected = marker;
  report.checks[0].detail = marker;
  const encoded = JSON.stringify({
    health: helpers.supportHealth(report),
    incidents: helpers.supportIncidents([{ summary: marker, details: marker, resolution_notes: marker, recorded_by: marker }]),
    history: helpers.supportHistory([{ details: { nested: marker }, unexpected: marker }]),
    maintenance: helpers.supportMaintenance([{ notes: marker, recorded_by: marker }]),
    migrations: helpers.supportMigrations([{ name: marker }])
  });
  assert.doesNotMatch(encoded, /PRIVATE_PATIENT_OR_SECRET/);
  assert.match(encoded, /on-demand/);
});

test('support collection failure cannot masquerade as an empty collection', async () => {
  const repository = loadTs('lib/repositories/system-repository.ts', {}, {
    'server-only': {}, '@/lib/supabase/server': { createServerSupabaseClient: async () => null, createServiceRoleSupabaseClient: () => null }
  });
  await assert.rejects(repository.getSystemIncidents(500, true), /not configured/);
});

test('old database locations and a stale migration record are flagged for review', async () => {
  const diagnostics = loadTs('lib/services/health-diagnostics.ts', { VERCEL: '1' });
  const rows = {
    theatre_suites: { data: [{ code: 'st-james' }, { code: 'atkinson-morley' }, { code: 'gynae' }], count: 3, error: null },
    theatreflow_schema_migrations: { data: { version: '0017', name: 'Previous migration', applied_at: '2026-08-13T16:56:20Z' }, error: null }
  };
  const client = {
    from: table => {
      const query = new Proxy({}, { get: (_, key) => key === 'then' ? resolve => resolve(rows[table] ?? { data: null, count: 0, error: null }) : () => query });
      return query;
    },
    rpc: async () => ({ data: null }), auth: { admin: { listUsers: async () => ({ error: null }) } }
  };
  const service = loadTs('lib/services/system-health.ts', { VERCEL: '1' }, {
    'server-only': {}, 'node:fs/promises': {}, '@/package.json': { version: '0.1.0' },
    '@/lib/supabase/server': { createServiceRoleSupabaseClient: () => client }, '@/lib/services/health-diagnostics': diagnostics
  });
  const report = await service.getSystemHealthReport();
  assert.equal(report.configuration.source, 'database');
  assert.equal(report.configuration.legacy_locations, true);
  assert.equal(report.configuration.status, 'warning');
  assert.equal(report.migration.version, '0017');
  assert.equal(report.migration.expected_version, '0019');
  assert.equal(report.migration.status, 'warning');
});
