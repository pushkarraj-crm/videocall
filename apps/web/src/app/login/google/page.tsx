'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { getAuthIntent } from '@/lib/auth/intent';

export default function GoogleCallbackPage() {
  const { acceptSession } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get('code');
    window.history.replaceState(null, '', window.location.pathname);
    if (!code || params.has('error')) {
      setError(params.get('error') === 'account' ? 'This account could not be linked. Verify your email or reset your password, and check that your account has access to this area.' : 'Google sign-in was cancelled or failed. Please try again.'); return;
    }
    void authApi.exchangeGoogle(code).then((session) => acceptSession(session, getAuthIntent()))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Google sign-in failed.'));
  }, [acceptSession]);
  return <AuthLayout title="Google sign-in" subtitle={error || 'Completing sign-in…'}>
    {error && <Link href="/login" className="text-[#FF6B9D]">Back to login</Link>}
  </AuthLayout>;
}
