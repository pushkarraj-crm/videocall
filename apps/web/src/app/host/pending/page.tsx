'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/shared/page-loader';
import { useAuth } from '@/hooks/use-auth';
import { hasHostRole } from '@/lib/auth/redirect';
import { hostsApi } from '@/lib/api/hosts';

export default function HostPendingPage() {
  const router = useRouter();
  const { isAuthenticated, session } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/host/login');
      return;
    }

    if (session && hasHostRole(session.user.roles)) {
      router.replace('/host/dashboard');
      return;
    }

    hostsApi
      .getApplication()
      .then((app) => {
        if (app.canAccessDashboard || app.status === 'approved') {
          router.replace('/host/dashboard');
          return;
        }
        if (app.status === 'rejected' || app.status === 'pending' || !app.status) {
          router.replace('/host/register');
          return;
        }
        router.replace('/host/register');
      })
      .catch(() => router.replace('/host/register'));
  }, [isAuthenticated, session, router]);

  return <PageLoader label="Opening host dashboard..." />;
}