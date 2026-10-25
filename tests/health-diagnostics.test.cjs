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
