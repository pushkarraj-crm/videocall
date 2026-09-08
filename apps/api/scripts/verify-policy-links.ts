/**
 * Verifies public legal page routes respond successfully.
 */
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';

const ROUTES = [
  '/privacy',
  '/terms',
  '/refund-policy',
  '/community-guidelines',
  '/content-policy',
  '/age-policy',
  '/contact',
  '/legal/privacy',
  '/legal/terms',
];

async function fetchRoute(route: string) {
  const res = await fetch(`${WEB}${route}`, { redirect: 'follow' });
  const text = await res.text();
  return { route, status: res.status, ok: res.ok, hasLovinexa: /Lovinexa/i.test(text) };
}

async function main() {
  const results = [];
  for (const route of ROUTES) {
    let last: { route: string; status: number; ok: boolean; hasLovinexa: boolean } | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      last = await fetchRoute(route);
      if (last.ok) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!last?.ok) throw new Error(`Route ${route} failed with status ${last?.status}`);
    results.push(last);
  }

  const rootRoutes = results.filter((r) => !r.route.startsWith('/legal/'));
  if (rootRoutes.some((r) => !r.hasLovinexa)) {
    throw new Error('One or more legal pages missing Lovinexa branding');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        webUrl: WEB,
        routes: results.map((r) => ({ route: r.route, status: r.status })),
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