'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';

export function RecoveryForm({ verify = false }: { verify?: boolean }) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const readToken = useRef(false);
  useEffect(() => {
    if (readToken.current) return;
    readToken.current = true;
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const submit = async () => {
    if (!verify && password !== confirm) { toast.error('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (verify) await authApi.verifyEmail(token); else await authApi.resetPassword(token, password);
      setDone(true); setToken(''); setPassword(''); setConfirm('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to continue'); }
    finally { setBusy(false); }
  };
  return <AuthLayout title={verify ? 'Verify email' : 'Set a new password'} subtitle={done ? (verify ? 'Your email is verified.' : 'Password updated. Sign in with your new password.') : 'Use the link sent to your email.'}>
    {!done && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {!token && <p className="text-sm text-white/60">The link is missing. Request a new one.</p>}
      {!verify && <>
        <Input aria-label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="New password (12+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Input aria-label="Confirm password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Confirm password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </>}
      <Button type="submit" disabled={busy || !token} className="w-full gradient-primary">{busy ? 'Please wait…' : verify ? 'Verify email' : 'Save password'}</Button>
    </form>}
    <Link href={token || done ? '/login' : '/login/forgot-password'} className="mt-4 block text-[#FF6B9D]">{token || done ? 'Back to login' : 'Request a new link'}</Link>
  </AuthLayout>;
}
