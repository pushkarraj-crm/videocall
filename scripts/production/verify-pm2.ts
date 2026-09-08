/**
 * Validates PM2 ecosystem configuration.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const ECOSYSTEM = resolve(ROOT, 'ecosystem.config.cjs');

function main() {
  if (!existsSync(ECOSYSTEM)) {
    console.error('Missing ecosystem.config.cjs');
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(ECOSYSTEM);
  const apps = config.apps ?? [];
  const names = apps.map((a: { name: string }) => a.name);

  const required = ['platform-api', 'platform-worker', 'platform-web'];
  const missing = required.filter((n) => !names.includes(n));

  const checks: Record<string, boolean> = {};
  for (const app of apps) {
    checks[`${app.name}:autorestart`] = app.autorestart === true;
    checks[`${app.name}:max_memory_restart`] = Boolean(app.max_memory_restart);
    checks[`${app.name}:kill_timeout`] = (app.kill_timeout ?? 0) >= 5000;
    if (app.name === 'platform-api' || app.name === 'platform-web') {
      checks[`${app.name}:cluster`] = app.exec_mode === 'cluster' && (app.instances ?? 0) >= 2;
    }
  }

  const failedChecks = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

  if (missing.length > 0 || failedChecks.length > 0) {
    console.error('PM2 verification failed', { missing, failedChecks });
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        apps: names,
        clusterApps: ['platform-api', 'platform-web'],
        checks: Object.keys(checks).length,
      },
      null,
      2,
    ),
  );
}

main();