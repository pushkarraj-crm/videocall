/**
 * Verifies production host favorites / follow flows.
 */
const API = process.env.API_URL ?? 'http://localhost:3001/v1';

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; retries?: number } = {},
) {
  const retries = opts.retries ?? 5;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json();
    if (res.status === 429 && attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (!res.ok || !json.success) {
    const err = new Error(json.error?.message ?? `API ${path} failed (${res.status})`) as Error & {
      code?: string;
      statusCode?: number;
    };
      err.code = json.error?.code;
      err.statusCode = res.status;
      throw err;
    }
    return json.data;
  }
  throw new Error(`API ${path} exhausted retries`);
}

async function main() {
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const userToken = userSession.accessToken as string;
  const hostToken = hostSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const hostId = hostSession.user.id as string;
  const userId = userSession.user.id as string;

  // Reset follow state from prior runs
  try {
    await api(`/hosts/${hostId}/follow`, { method: 'DELETE', token: userToken });
  } catch {
    /* was not following */
  }

  const follow = await api(`/hosts/${hostId}/follow`, {
    method: 'POST',
    token: userToken,
  });
  if (!follow.following) throw new Error('Follow failed');
  if (follow.followerCount < 1) throw new Error('Follower count not updated');

  try {
    await api(`/hosts/${hostId}/follow`, { method: 'POST', token: userToken });
    throw new Error('Duplicate follow should be blocked');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'DUPLICATE_FOLLOW') throw err;
  }

  try {
    await api(`/hosts/${hostId}/follow`, { method: 'POST', token: hostToken });
    throw new Error('Self follow should be blocked');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'SELF_FOLLOW') throw err;
  }

  const favorites = await api('/favorites', { token: userToken });
  if (!favorites.items.some((h: { userId: string }) => h.userId === hostId)) {
    throw new Error('Favorites missing host');
  }

  const discover = await api('/hosts/discover?limit=10', { token: userToken });
  const discovered = discover.hosts.find((h: { userId: string }) => h.userId === hostId);
  if (!discovered?.isFollowing) throw new Error('Discover missing isFollowing');
  if (discovered.followerCount == null) throw new Error('Discover missing followerCount');

  const profile = await api(`/users/${hostId}`, { token: userToken });
  if (!profile.followStats?.isFollowing) throw new Error('Profile followStats missing');

  const hostFollowers = await api('/host/followers', { token: hostToken });
  if (hostFollowers.totalFollowers < 1) throw new Error('Host followers summary empty');

  const unfollow = await api(`/hosts/${hostId}/follow`, {
    method: 'DELETE',
    token: userToken,
  });
  if (unfollow.following) throw new Error('Unfollow should set following false');

  const restore = await api(`/hosts/${hostId}/follow`, {
    method: 'POST',
    token: userToken,
  });
  if (!restore.following) throw new Error('Re-follow restore failed');

  const adminList = await api('/admin/followers?limit=10', { token: adminToken });
  if (adminList.total < 1) throw new Error('Admin followers list empty');

  const adminStats = await api('/admin/followers/stats', { token: adminToken });
  if (adminStats.totalFollows < 1) throw new Error('Admin stats empty');

  console.log(
    JSON.stringify(
      {
        passed: true,
        hostId,
        userId,
        followerCount: follow.followerCount,
        adminTotal: adminList.total,
        totalFollows: adminStats.totalFollows,
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