/**
 * Validates Docker production infrastructure files.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

const REQUIRED_FILES = [
  'apps/api/Dockerfile',
  'apps/web/Dockerfile',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'docker-compose.staging.yml',
  '.dockerignore',
];

const REQUIRED_SERVICES = [
  'postgres',
  'redis',
  'api',
  'worker',
  'web',
  'nginx',
];

const SERVICES_WITH_HEALTHCHECK = ['api', 'web', 'postgres', 'redis', 'nginx'];

function main() {
  const missing: string[] = [];

  for (const file of REQUIRED_FILES) {
    if (!existsSync(resolve(ROOT, file))) {
      missing.push(file);
    }
  }

  const prodCompose = readFileSync(resolve(ROOT, 'docker-compose.prod.yml'), 'utf8');

  for (const service of REQUIRED_SERVICES) {
    if (!prodCompose.includes(`  ${service}:`)) {
      missing.push(`service:${service}`);
    }
  }

  const healthcheckCount = (prodCompose.match(/healthcheck:/g) ?? []).length;
  if (healthcheckCount < SERVICES_WITH_HEALTHCHECK.length) {
    missing.push(`healthcheck:count=${healthcheckCount}`);
  }

  const apiDockerfile = readFileSync(resolve(ROOT, 'apps/api/Dockerfile'), 'utf8');
  const webDockerfile = readFileSync(resolve(ROOT, 'apps/web/Dockerfile'), 'utf8');

  if (!apiDockerfile.includes('HEALTHCHECK')) missing.push('api:HEALTHCHECK');
  if (!webDockerfile.includes('HEALTHCHECK')) missing.push('web:HEALTHCHECK');
  if (!apiDockerfile.includes('USER platform')) missing.push('api:non-root-user');
  if (!webDockerfile.includes('USER platform')) missing.push('web:non-root-user');

  if (missing.length > 0) {
    console.error('Docker verification failed:', missing);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        files: REQUIRED_FILES.length,
        services: REQUIRED_SERVICES.length,
        healthchecks: SERVICES_WITH_HEALTHCHECK.length,
      },
      null,
      2,
    ),
  );
}

main();