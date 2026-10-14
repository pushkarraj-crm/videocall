'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { PageLoader } from '@/components/shared/page-loader';
import { ApiClientError } from '@/lib/api/client';

/** Paths that do not require an authenticated session. */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/become-host',
  '/admin/login',
  '/host/login',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/community-guidelines',
  '/content-policy',
  '/age-policy',
  '/contact',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/legal/')) return true;
  // Local-only dev login runners (/dev/login/user|host|admin). Middleware 404s in production.
  if (pathname.startsWith('/dev/')) return true;
  return false;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const accessToken = session?.accessToken;
  const isPublic = isPublicPath(pathname);
  // Admin shell uses AdminGuard for auth; do not bounce /admin/* to /login here.
  const isAdminArea = pathname.startsWith('/admin');

  useEffect(() => {
    const finishHydration = () => setHasHydrated();
    const unsub = useAuthStore.persist.onFinishHydration(finishHydration);
    if (useAuthStore.persist.hasHydrated()) {
      finishHydration();
    } else {
      void useAuthStore.persist.rehydrate();
    }
    return unsub;
  }, [setHasHydrated]);

  // One refresh per session, shared by every component using useAuth.
  useEffect(() => {
    if (!hasHydrated || !accessToken) return;
    void refreshProfile().catch((error: unknown) => {
      if (error instanceof ApiClientError && error.statusCode === 401 &&
          useAuthStore.getState().session?.accessToken === accessToken) {
        useAuthStore.getState().logout();
      }
    });
  }, [hasHydrated, accessToken, refreshProfile]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (session) return;
    if (isPublic || isAdminArea) return;
    router.replace('/login');
  }, [session, pathname, router, isPublic, isAdminArea, hasHydrated]);

  if (!hasHydrated && !isPublic) {
    return <PageLoader />;
  }

  if (!session && !isPublic && !isAdminArea) {
    return <PageLoader />;
  }

  return <>{children}</>;
}
