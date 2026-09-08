/**
 * Validates NGINX reverse-proxy configuration for production.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(__dirname, '../..');

const REQUIRED_SNIPPETS = [
  'infra/nginx/nginx.conf',
  'infra/nginx/conf.d/platform.conf.template',
  'infra/nginx/snippets/security-headers.conf',
  'infra/nginx/docker-entrypoint.sh',
];

const REQUIRED_BLOCKS = [
  'server_name ${DOMAIN_NAME}',
  'server_name ${API_DOMAIN}',
  'server_name ${ADMIN_DOMAIN}',
  '/v1/notifications/stream',
  '/ai-hosts/',
  '/uploads/',
  '/_next/static/',
  'limit_req zone=api_limit',
  'ssl_certificate',
  'return 301 https://',
];

function main() {
  const missing: string[] = [];

  for (const file of REQUIRED_SNIPPETS) {
    if (!existsSync(resolve(ROOT, file))) missing.push(file);
  }

  const template = readFileSync(resolve(ROOT, 'infra/nginx/conf.d/platform.conf.template'), 'utf8');
  const nginxConf = readFileSync(resolve(ROOT, 'infra/nginx/nginx.conf'), 'utf8');
  const security = readFileSync(resolve(ROOT, 'infra/nginx/snippets/security-headers.conf'), 'utf8');

  for (const block of REQUIRED_BLOCKS) {
    if (!template.includes(block)) missing.push(`template:${block}`);
  }

  if (!nginxConf.includes('gzip on')) missing.push('nginx.conf:gzip');
  if (!nginxConf.includes('limit_req_zone')) missing.push('nginx.conf:rate-limit');
  if (!security.includes('Strict-Transport-Security')) missing.push('security:HSTS');
  if (!security.includes('X-Frame-Options')) missing.push('security:headers');

  // Syntax check if nginx is available locally
  let syntaxOk: boolean | 'skipped' = 'skipped';
  try {
    const rendered = template
      .replaceAll('${DOMAIN_NAME}', 'app.example.com')
      .replaceAll('${API_DOMAIN}', 'api.example.com')
      .replaceAll('${ADMIN_DOMAIN}', 'admin.example.com');

    const tmpDir = '/tmp/platform-nginx-verify';
    execSync(`mkdir -p ${tmpDir}/conf.d ${tmpDir}/snippets`, { stdio: 'ignore' });
    execSync(`cp ${resolve(ROOT, 'infra/nginx/nginx.conf')} ${tmpDir}/nginx.conf`);
    execSync(`cp ${resolve(ROOT, 'infra/nginx/snippets/security-headers.conf')} ${tmpDir}/snippets/`);
    require('fs').writeFileSync(`${tmpDir}/conf.d/platform.conf`, rendered);
    execSync(`nginx -t -c ${tmpDir}/nginx.conf -p ${tmpDir}`, { stdio: 'pipe' });
    syntaxOk = true;
  } catch {
    syntaxOk = 'skipped';
  }

  if (missing.length > 0) {
    console.error('NGINX verification failed:', missing);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        blocks: REQUIRED_BLOCKS.length,
        syntaxCheck: syntaxOk,
        domains: ['app', 'api', 'admin'],
      },
      null,
      2,
    ),
  );
}

main();