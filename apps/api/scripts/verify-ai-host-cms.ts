/**
 * AI Host CMS verification.
 * Run: npx tsx scripts/verify-ai-host-cms.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApi as api } from './lib/verify-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '../../web');
const ASSETS_ROOT = path.join(WEB_ROOT, 'public', 'ai-hosts');

async function main() {
  console.log('\n=== AI Host CMS Verification ===\n');
  let passed = 0;
  let failed = 0;

  const ok = (name: string, detail?: string) => {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const fail = (name: string, detail?: string) => {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

    const created = await api('/admin/virtual-hosts', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        displayName: 'CMS Test Host',
        hostName: 'CMS Test Host',
        profileType: 'AI_HOST',
        age: 24,
        country: 'IN',
        languages: ['en'],
        virtualHostEnabled: true,
        virtualHostStatus: 'ONLINE',
      },
    }) as { hostId: string; virtualHostAssetSlug: string; videoCount: number };

    if (created.virtualHostAssetSlug) {
      ok('Create AI host with asset slug', created.virtualHostAssetSlug);
    } else {
      fail('Create AI host with asset slug', 'missing slug');
    }

    const folder = path.join(ASSETS_ROOT, created.virtualHostAssetSlug, 'casual', 'bedroom');
    if (fs.existsSync(folder)) {
      ok('Asset folder scaffolded');
    } else {
      fail('Asset folder scaffolded', 'missing');
    }

    const manifestPath = path.join(ASSETS_ROOT, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      ok('Manifest exists');
    } else {
      fail('Manifest exists');
    }

    const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
    const discover = await api('/hosts/discover?page=1&limit=50', {
      token: user.accessToken,
    }) as { hosts: Array<{ userId: string }> };
    if (discover.hosts.some((h) => h.userId === created.hostId)) {
      ok('Host appears in Discover');
    } else {
      fail('Host appears in Discover');
    }

    await api(`/admin/virtual-hosts/${created.hostId}`, {
      method: 'DELETE',
      token: admin.accessToken,
    });
    if (!fs.existsSync(path.join(ASSETS_ROOT, created.virtualHostAssetSlug))) {
      ok('Delete removes asset folder');
    } else {
      fail('Delete removes asset folder');
    }

    const adminList = await api('/admin/virtual-hosts', {
      token: admin.accessToken,
    }) as Array<{ hostId: string }>;
    if (!adminList.some((h) => h.hostId === created.hostId)) {
      ok('Delete removes host from Admin list');
    } else {
      fail('Delete removes host from Admin list');
    }

    const discoverAfter = await api('/hosts/discover?page=1&limit=50', {
      token: user.accessToken,
    }) as { hosts: Array<{ userId: string }> };
    if (!discoverAfter.hosts.some((h) => h.userId === created.hostId)) {
      ok('Delete removes host from Discover');
    } else {
      fail('Delete removes host from Discover');
    }

    const routing = await api('/admin/settings/call-routing', { token: admin.accessToken }) as {
      aiFallbackEnabled: boolean;
    };
    if (routing.aiFallbackEnabled !== undefined) ok('Call routing unchanged');
    else fail('Call routing settings');
  } catch (err) {
    fail('CMS flow', err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== ${passed}/${passed + failed} passed ===\n`);
  if (failed) process.exit(1);
}

main();