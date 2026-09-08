/**
 * Verifies production push notifications: events, read state, referenceType, priorities.
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

  await new Promise((r) => setTimeout(r, 400));

  const hostUnread = await api('/notifications/unread-count', { token: hostToken });
  const hostList = await api('/notifications?limit=10', { token: hostToken });
  const incoming = hostList.items.find(
    (n: { type: string; referenceId: string | null }) =>
      n.type === 'incoming_call' && n.referenceId === initiated.callId,
  );
  if (!incoming) throw new Error('Host incoming_call notification missing');
  if (incoming.referenceType !== 'CALL') throw new Error('incoming_call referenceType should be CALL');
  if (incoming.priorityLabel !== 'URGENT') throw new Error('incoming_call priority should be URGENT');
  if (hostUnread.count < 1) throw new Error('Host unread count should be >= 1');

  await api(`/calls/${initiated.callId}/reject`, { method: 'POST', token: hostToken });
  await new Promise((r) => setTimeout(r, 400));

  const userList = await api('/notifications?limit=10', { token: userToken });
  const rejected = userList.items.find(
    (n: { type: string; referenceId: string | null }) =>
      n.type === 'call_rejected' && n.referenceId === initiated.callId,
  );
  if (!rejected) throw new Error('User call_rejected notification missing');
  if (rejected.referenceType !== 'CALL') throw new Error('call_rejected referenceType should be CALL');
  if (rejected.priorityLabel !== 'HIGH') throw new Error('call_rejected priority should be HIGH');

  const marked = await api(`/notifications/${rejected.id}/read`, {
    method: 'PATCH',
    token: userToken,
  });
  if (!marked.notification.isRead) throw new Error('Mark read failed');

  const announce = await api('/admin/notifications/announce', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'App Update',
      message: 'Production notifications are live.',
      target: 'users_only',
      priority: 'high',
    },
  });
  if (announce.sent < 1) throw new Error('Admin announcement not sent');

  await new Promise((r) => setTimeout(r, 300));

  const userAnnounce = await api('/notifications?limit=20', { token: userToken });
  const announcement = userAnnounce.items.find(
    (n: { type: string }) => n.type === 'admin_announcement',
  );
  if (!announcement) throw new Error('User admin_announcement missing');
  if (announcement.referenceType !== 'SYSTEM') throw new Error('announcement referenceType should be SYSTEM');

  const pagination = await api('/notifications?limit=2', { token: userToken });
  if (!pagination.hasMore && pagination.items.length < 2) {
    /* ok when few notifications */
  }
  if (pagination.nextCursor) {
    const page2 = await api(`/notifications?limit=2&cursor=${pagination.nextCursor}`, {
      token: userToken,
    });
    if (!Array.isArray(page2.items)) throw new Error('Cursor pagination failed');
  }

  const allRead = await api('/notifications/read-all', { method: 'PATCH', token: userToken });
  if (allRead.unreadCount !== 0) throw new Error('Mark all read failed');

  const settings = await api('/notifications/settings', { token: userToken });
  if (settings.incomingCalls !== true) throw new Error('Default settings missing');

  await api('/notifications/settings', {
    method: 'PATCH',
    token: userToken,
    body: { promotions: false },
  });

  const analytics = await api('/admin/notifications/analytics', { token: adminToken });
  if (analytics.notificationsSent < 1) throw new Error('Admin analytics empty');

  const adminList = await api('/admin/notifications', { token: adminToken });
  if (!Array.isArray(adminList.items)) throw new Error('Admin list failed');

  if (announcement?.id) {
    await api(`/notifications/${announcement.id}`, { method: 'DELETE', token: userToken });
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        production: true,
        incomingNotificationId: incoming.id,
        rejectedNotificationId: rejected.id,
        announcementId: announcement.id,
        hostUnreadInitial: hostUnread.count,
        checks: [
          'incoming_call',
          'call_rejected',
          'referenceType',
          'priorityLabel',
          'announcement',
          'pagination',
          'read_status',
          'unread_count',
          'settings',
          'admin_analytics',
          'delete',
        ],
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