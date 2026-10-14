'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { PageLoader } from '@/components/shared/page-loader';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);
  const isAdmin = useAuthStore((s) =>
    (s.profile?.roles ?? s.session?.user?.roles ?? []).some((r) =>
      ['admin', 'super_admin', 'moderator', 'grievance_officer', 'support'].includes(r),
    ),
  );

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

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session) {
      router.replace('/admin/login');
      return;
    }
    if (!isAdmin) {
      router.replace('/home');
    }
  }, [hasHydrated, session, isAdmin, router]);

  if (!hasHydrated) {
    return <PageLoader variant="admin" />;
  }

  if (!session || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}