/**
 * Verifies legal policy public and admin compliance endpoints.
 */
import { verifyApi as api } from './lib/verify-api';

const REQUIRED_SLUGS = [
  'privacy',
  'terms',
  'refund-policy',
  'community-guidelines',
  'content-policy',
  'age-policy',
];

async function main() {
  const list = await api('/legal/policies');
  if (!Array.isArray(list.items)) throw new Error('legal.policies.items missing');

  for (const slug of REQUIRED_SLUGS) {
    const found = (list.items as Array<{ slug: string }>).some((p) => p.slug === slug);
    if (!found) throw new Error(`Missing published policy: ${slug}`);

    const policy = await api(`/legal/policies/${slug}`);
    if (!policy.title || !policy.content || !policy.version) {
      throw new Error(`Policy ${slug} missing title/content/version`);
    }
    if (String(policy.content).length < 100) {
      throw new Error(`Policy ${slug} content too short`);
    }
  }

  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const token = admin.accessToken as string;

  const adminList = await api('/admin/compliance/policies', { token });
  if (!Array.isArray(adminList.items) || adminList.items.length < REQUIRED_SLUGS.length) {
    throw new Error('admin compliance policies incomplete');
  }

  const history = await api('/admin/compliance/policies/privacy/history', { token });
  if (!Array.isArray(history.items) || history.items.length < 1) {
    throw new Error('privacy history missing revisions');
  }

  const draftTitle = `Privacy Policy Verify ${Date.now()}`;
  const updated = await api('/admin/compliance/policies/privacy', {
    method: 'PATCH',
    token,
    body: { title: draftTitle, publish: false },
  });
  if (updated.title !== draftTitle) throw new Error('draft update failed');

  const published = await api('/admin/compliance/policies/privacy', {
    method: 'PATCH',
    token,
    body: { publish: true },
  });
  const bumped = Number.parseFloat(published.version);
  if (!Number.isFinite(bumped) || bumped < 1) throw new Error('version bump failed');

  const publicPolicy = await api('/legal/policies/privacy');
  if (publicPolicy.version !== published.version) {
    throw new Error('published version not reflected on public endpoint');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        policyCount: list.items.length,
        publishedVersion: published.version,
        revisionCount: history.items.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});