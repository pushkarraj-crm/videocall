'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from '@/components/auth/login-form';
import { PageLoader } from '@/components/shared/page-loader';
import { useAuthStore } from '@/stores/auth-store';

function AdminLoginContent() {
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
    const finish = () => setHasHydrated();
    const unsub = useAuthStore.persist.onFinishHydration(finish);
    if (useAuthStore.persist.hasHydrated()) finish();
    else void useAuthStore.persist.rehydrate();
    return unsub;
  }, [setHasHydrated]);

  // Already signed in as admin → dashboard (existing post-auth behavior)
  useEffect(() => {
    if (!hasHydrated) return;
    if (session && isAdmin) {
      router.replace('/admin');
    }
  }, [hasHydrated, session, isAdmin, router]);

  if (!hasHydrated) {
    return <PageLoader label="Loading..." />;
  }

  if (session && isAdmin) {
    return <PageLoader label="Opening admin…" />;
  }

  return (
    <AuthLayout
      title="Admin Access"
      subtitle="Authorized personnel only"
      className="max-w-md"
    >
      <div className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm text-white/50">
        <Shield className="h-4 w-4" />
        Internal use only
      </div>
      <LoginForm
        intent="admin"
        showBecomeHost={false}
        tagline="Sign in to continue"
        subtitle="Your role is determined by your account"
      />
      <p className="mt-4 text-center text-xs text-white/35">
        <Link href="/login" className="hover:text-white/60">
          ← Back to user login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <AdminLoginContent />
    </Suspense>
  );
}
