/**
 * Final release verification — runs critical subsystem checks.
 * Usage: npx tsx scripts/production/verify-release.ts
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const API = resolve(ROOT, 'apps/api');

type Check = { name: string; passed: boolean; detail?: string; category: string };

function run(cmd: string, cwd = ROOT): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, stdio: 'pipe', env: { ...process.env, ENABLE_DEV_AUTH: 'true' } }).toString();
    return { ok: true, output };
  } catch (err) {
    const output = err instanceof Error && 'stdout' in err ? String((err as { stdout?: Buffer }).stdout ?? '') : String(err);
    return { ok: false, output };
  }
}

async function fetchHealth() {
  const base = process.env.API_URL ?? 'http://localhost:3001/v1';
  const endpoints = ['/health', '/health/live', '/health/ready', '/health/metrics'] as const;
  const out: Record<string, boolean> = {};
  for (const path of endpoints) {
    try {
      const res = await fetch(`${base}${path}`);
      const json = await res.json();
      out[path] = res.ok && json.success === true;
    } catch {
      out[path] = false;
    }
  }
  return out;
}

async function main() {
  const checks: Check[] = [];

  const infra = ['verify-env', 'verify-docker', 'verify-nginx', 'verify-pm2'] as const;
  for (const script of infra) {
    const fileArg = script === 'verify-env' ? '--file .env.production.example' : '';
    const result = run(`npx tsx scripts/production/${script}.ts ${fileArg}`.trim());
    checks.push({ name: script, passed: result.ok, category: 'deployment', detail: result.ok ? undefined : result.output.slice(0, 200) });
  }

  const apiScripts = [
    'verify-auth',
    'verify-legal',
    'verify-payment',
    'verify-wallet',
    'verify-call-deduction',
    'verify-call-routing',
    'verify-heartbeat',
    'verify-dashboard',
    'verify-analytics',
    'verify-payments',
    'verify-support',
    'verify-age-check',
    'verify-policy-links',
  ] as const;

  for (const script of apiScripts) {
    const cwd = script === 'verify-policy-links' || script === 'verify-age-check' ? API : API;
    const cmd =
      script === 'verify-policy-links'
        ? `WEB_URL=${process.env.WEB_URL ?? 'http://localhost:3000'} npx tsx scripts/${script}.ts`
        : `npx tsx scripts/${script}.ts`;
    const result = run(cmd, cwd);
    checks.push({ name: script, passed: result.ok, category: 'application', detail: result.ok ? undefined : result.output.slice(0, 200) });
  }

  const health = await fetchHealth();
  for (const [path, ok] of Object.entries(health)) {
    checks.push({ name: `live${path}`, passed: ok, category: 'health' });
  }

  const hardening = [
    { name: 'nginx-blocks-kyc-uploads', passed: existsSync(resolve(ROOT, 'infra/nginx/conf.d/platform.conf.template')) && run('grep -q "uploads/kyc" infra/nginx/conf.d/platform.conf.template').ok, category: 'security' },
    { name: 'trust-proxy-configured', passed: run('grep -q "trust proxy" apps/api/src/main.ts').ok, category: 'security' },
    { name: 'payment-confirm-dto', passed: existsSync(resolve(API, 'src/modules/payments/dto/confirm-payment.dto.ts')), category: 'security' },
    { name: 'kyc-callback-guard', passed: run('grep -q InternalApiKeyGuard apps/api/src/modules/kyc/kyc.controller.ts').ok, category: 'security' },
    { name: 'legal-html-sanitizer', passed: existsSync(resolve(ROOT, 'apps/web/src/lib/legal/sanitize-html.ts')), category: 'security' },
    { name: 'backup-docker-fallback', passed: run('grep -q dump_via_docker scripts/production/backup-postgres.sh').ok, category: 'database' },
  ];
  checks.push(...hardening);

  const failed = checks.filter((c) => !c.passed);
  const byCategory = checks.reduce<Record<string, { passed: number; total: number }>>((acc, c) => {
    acc[c.category] = acc[c.category] ?? { passed: 0, total: 0 };
    acc[c.category].total += 1;
    if (c.passed) acc[c.category].passed += 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        passed: failed.length === 0,
        total: checks.length,
        failed: failed.length,
        byCategory,
        failures: failed.map((f) => ({ name: f.name, detail: f.detail })),
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});