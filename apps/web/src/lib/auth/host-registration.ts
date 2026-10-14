import { authApi } from '@/lib/api/auth';
import { hostsApi } from '@/lib/api/hosts';
import { ApiClientError } from '@/lib/api/client';
import { devLog } from '@/lib/dev-log';
import { useAuthStore } from '@/stores/auth-store';

export class HostRegistrationError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_APPROVED' | 'NO_HOST_ROLE' | 'DASHBOARD_FORBIDDEN' | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'HostRegistrationError';
  }
}

/** Refresh JWT session so client roles match the database after host apply. */
export async function syncHostAuthSession(): Promise<void> {
  const { session, setSession, setProfile } = useAuthStore.getState();
  if (!session?.refreshToken) {
    devLog('HOST_SESSION_SYNC_SKIP', { reason: 'no_refresh_token' });
    const profile = await authApi.getMe();
    setProfile(profile);
    if (profile.roles?.includes('host')) {
      setSession({
        ...session!,
        user: {
          ...session!.user,
          roles: profile.roles,
          needsOnboarding: false,
        },
      });
    }
    return;
  }

  devLog('HOST_SESSION_SYNC_START');
  const refreshed = await authApi.refresh(session.refreshToken);
  devLog('HOST_SESSION_SYNC_OK', {
    userId: refreshed.user.id,
    roles: refreshed.user.roles,
    needsOnboarding: refreshed.user.needsOnboarding,
  });
  setSession(refreshed);
  const profile = await authApi.getMe();
  setProfile(profile);
}

/**
 * Complete host onboarding: apply, verify access, sync session, probe dashboard.
 * Throws HostRegistrationError when the account is not ready for the host dashboard.
 */
export async function finalizeHostRegistration(): Promise<void> {
  devLog('HOST_REGISTER_APPLY_START');
  const applied = await hostsApi.apply();
  devLog('HOST_REGISTER_APPLY_OK', {
    status: applied.status,
    instant: applied.instant,
  });

  const application = await hostsApi.getApplication();
  devLog('HOST_REGISTER_APPLICATION', {
    status: application.status,
    isHost: application.isHost,
    canAccessDashboard: application.canAccessDashboard,
  });

  if (!application.canAccessDashboard) {
    throw new HostRegistrationError(
      'Host account is not ready yet. Please try again.',
      'NOT_APPROVED',
    );
  }

  await syncHostAuthSession();

  const profile = useAuthStore.getState().profile;
  const session = useAuthStore.getState().session;
  const roles = profile?.roles ?? session?.user?.roles ?? [];
  devLog('HOST_REGISTER_ROLES', { roles });

  if (!roles.includes('host')) {
    throw new HostRegistrationError(
      'Host role was not assigned. Please try again.',
      'NO_HOST_ROLE',
    );
  }

  try {
    devLog('HOST_DASHBOARD_PROBE_START');
    await hostsApi.dashboard();
    devLog('HOST_DASHBOARD_PROBE_OK');
  } catch (e) {
    const err = e instanceof ApiClientError ? e : null;
    devLog('HOST_DASHBOARD_PROBE_FAIL', {
      statusCode: err?.statusCode,
      code: err?.code,
      message: e instanceof Error ? e.message : String(e),
    });
    throw new HostRegistrationError(
      err?.statusCode === 403 || err?.statusCode === 401
        ? 'Host dashboard is not available yet. Please complete setup.'
        : err?.message ?? 'Could not verify host dashboard access',
      'DASHBOARD_FORBIDDEN',
    );
  }

  // Role is already on the authenticated session after syncHostAuthSession — no client mode switch.
}