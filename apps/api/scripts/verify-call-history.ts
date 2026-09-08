/**
 * Verifies call history records are created without affecting call flow.
 */
const API = process.env.API_URL ?? 'http://localhost:3001/v1';

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
  }
  return json.data;
}

async function main() {
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const userToken = userSession.accessToken as string;
  const hostToken = hostSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const hostId = hostSession.user.id as string;

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: userToken,
    body: { calleeId: hostId },
  });

  await new Promise((r) => setTimeout(r, 300));

  const rejected = await api(`/calls/${initiated.callId}/reject`, {
    method: 'POST',
    token: hostToken,
  });
  if (rejected.status !== 'rejected') throw new Error('Reject call failed');

  await new Promise((r) => setTimeout(r, 500));

  const adminCalls = await api('/admin/calls?status=rejected&limit=5', { token: adminToken });
  const record = adminCalls.items.find((r: { callId: string }) => r.callId === initiated.callId);
  if (!record) throw new Error('Call history record not found after reject');

  const userHistory = await api('/history?limit=10', { token: userToken });
  const hostHistory = await api('/host/history?limit=10', { token: hostToken });

  const detail = await api(`/history/${record.id}`, { token: userToken });
  if (detail.callId !== initiated.callId) throw new Error('History detail mismatch');

  console.log(
    JSON.stringify(
      {
        passed: true,
        callId: initiated.callId,
        historyId: record.id,
        displayStatus: record.displayStatus,
        userHistoryCount: userHistory.items.length,
        hostHistoryCount: hostHistory.items.length,
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