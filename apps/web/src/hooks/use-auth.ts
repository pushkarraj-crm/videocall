'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/react/shallow';
import { authApi } from '@/lib/api/auth';
import type { AuthIntent } from '@/lib/auth/constants';
import { getPostAuthPath, hasAdminRole } from '@/lib/auth/redirect';
import { clearAuthIntent, getAuthIntent } from '@/lib/auth/intent';
import type { AuthSession } from '@/types/api';

/**
 * Normalize a logout redirect target.
 * Never pass MouseEvent / objects into router.replace (causes path.startsWith crash).
 */
export function resolveLogoutRedirect(
  redirectTo: unknown,
  fallback: string,
): string {
  if (typeof redirectTo === 'string' && redirectTo.startsWith('/')) {
    return redirectTo;
  }
  return fallback;
}

/** Default post-logout landing by account type. */
export function defaultLogoutPath(options: {
  isAdmin: boolean;
  isHost: boolean;
}): string {
  if (options.isAdmin) return '/admin/login';
  if (options.isHost) return '/host/login';
  return '/login';
}

export function useAuth() {
  const router = useRouter();
  const {
    session,
    profile,
    setSession,
    setProfile,
    logout: clearSession,
    refreshProfile,
    isHost,
    isAdmin,
  } = useAuthStore(useShallow((state) => ({
    session: state.session,
    profile: state.profile,
    setSession: state.setSession,
    setProfile: state.setProfile,
    logout: state.logout,
    refreshProfile: state.refreshProfile,
    isHost: state.isHost,
    isAdmin: state.isAdmin,
  })));

  // Prevent logout redirect when React passes the click event as first arg.
  const loggingOutRef = useRef(false);

  const navigateAfterAuth = useCallback(
    (result: AuthSession, intent?: AuthIntent) => {
      const resolvedIntent = intent ?? getAuthIntent();
      const roles = result.user.roles ?? [];

      // Admin login form: reject non-admin accounts instead of dumping them on /home.
      if (resolvedIntent === 'admin' && !hasAdminRole(roles)) {
        clearAuthIntent();
        clearSession();
        throw new Error('This account does not have admin access.');
      }

      const path = getPostAuthPath(result, resolvedIntent);
      clearAuthIntent();
      if (typeof path === 'string' && path.startsWith('/')) {
        router.push(path);
      } else {
        router.push('/home');
      }
    },
    [router, clearSession],
  );

  const acceptSession = useCallback(
    (result: AuthSession, intent?: AuthIntent) => {
      setSession(result);
      navigateAfterAuth(result, intent);
      return result;
    }, [setSession, navigateAfterAuth],
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string, intent?: AuthIntent) => {
      const result = await authApi.login(email, password, intent);
      return acceptSession(result, intent);
    }, [acceptSession],
  );

  const registerWithPassword = useCallback(
    async (email: string, password: string, displayName: string, intent?: AuthIntent) => {
      const result = await authApi.register(email, password, displayName);
      return acceptSession(result, intent);
    }, [acceptSession],
  );
  const loginWithDev = useCallback(
    async (
      payload?: {
        phone?: string;
        displayName?: string;
        role?: 'user' | 'host' | 'admin';
        seedCoins?: number;
      },
      intent?: AuthIntent,
    ) => {
      const result = await authApi.devLogin(payload);
      setSession(result);
      const resolvedIntent =
        intent ??
        (payload?.role === 'admin' ? 'admin' : payload?.role === 'host' ? 'host' : 'user');
      navigateAfterAuth(result, resolvedIntent);
      return result;
    },
    [setSession, navigateAfterAuth],
  );

  /**
   * Logout and navigate to a safe string route.
   * Accepts only string paths — ignores event objects from onClick={logout}.
   */
  const logoutAndRedirect = useCallback(
    (redirectTo?: unknown) => {
      loggingOutRef.current = true;

      const host = isHost();
      const admin = isAdmin();
      const fallback = defaultLogoutPath({ isAdmin: admin, isHost: host });
      const target = resolveLogoutRedirect(redirectTo, fallback);

      clearSession();
      clearAuthIntent();

      // Defer navigation so state flush is visible before route change.
      try {
        router.replace(target);
      } finally {
        // Allow future sessions after navigation tick.
        queueMicrotask(() => {
          loggingOutRef.current = false;
        });
      }
    },
    [router, clearSession, isHost, isAdmin],
  );

  return {
    session,
    profile,
    isAuthenticated: !!session,
    acceptSession,
    loginWithPassword,
    registerWithPassword,
    loginWithDev,
    logout: logoutAndRedirect,
    refreshProfile,
    isHost: isHost(),
    isAdmin: isAdmin(),
    setProfile,
  };
}
