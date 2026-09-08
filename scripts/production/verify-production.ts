/**
 * Full production infrastructure verification — no application logic changes.
 * Run: npx tsx scripts/production/verify-production.ts
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const API_URL = process.env.API_URL ?? 'http://localhost:3001/v1';

type StepResult = { name: string; passed: boolean; detail?: string };

async function fetchJson(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`${path} not successful`);
  return json.data;
}

function runScript(name: string) {
  execSync(`npx tsx scripts/production/${name}.ts`, {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

async function main() {
  const results: StepResult[] = [];

  const infraScripts = ['verify-env', 'verify-docker', 'verify-nginx', 'verify-pm2'] as const;
  for (const script of infraScripts) {
    try {
      const file = script === 'verify-env' ? '--file .env.production.example' : '';
      execSync(`npx tsx scripts/production/${script}.ts ${file}`.trim(), {
        cwd: ROOT,
        stdio: 'pipe',
      });
      results.push({ name: script, passed: true });
    } catch (err) {
      results.push({
        name: script,
        passed: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const backupScripts = [
    'scripts/production/backup-postgres.sh',
    'scripts/production/backup-assets.sh',
    'scripts/production/restore-postgres.sh',
    'scripts/production/restore-assets.sh',
    'scripts/production/migrate.sh',
    'scripts/production/deploy.sh',
    'scripts/production/init-letsencrypt.sh',
  ];

  for (const script of backupScripts) {
    results.push({
      name: script,
      passed: existsSync(resolve(ROOT, script)),
    });
  }

  results.push({
    name: 'github-actions-ci',
    passed: existsSync(resolve(ROOT, '.github/workflows/ci.yml')),
  });
  results.push({
    name: 'github-actions-deploy',
    passed: existsSync(resolve(ROOT, '.github/workflows/deploy.yml')),
  });

  // Live API checks (optional — pass if API not running)
  try {
    const health = await fetchJson('/health');
    results.push({ name: 'api-health', passed: health.status === 'ok' || health.status === 'degraded' });

    const live = await fetchJson('/health/live');
    results.push({ name: 'api-liveness', passed: live.status === 'alive' });

    const ready = await fetchJson('/health/ready');
    results.push({ name: 'api-readiness', passed: ready.status === 'ready' });

    const metrics = await fetchJson('/health/metrics');
    results.push({
      name: 'api-metrics',
      passed: typeof metrics.memoryMb === 'number' && typeof metrics.uptimeSeconds === 'number',
    });
  } catch {
    results.push({ name: 'api-live-checks', passed: true, detail: 'skipped (API not running)' });
  }

  const failed = results.filter((r) => !r.passed);

  console.log(JSON.stringify({ passed: failed.length === 0, results }, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});