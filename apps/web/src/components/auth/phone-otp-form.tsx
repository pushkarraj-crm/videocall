'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import type { AuthIntent } from '@/lib/auth/constants';

type Challenge = { challengeId: string; phone: string; intent: AuthIntent; sentAt: number };
export default function PhoneOtpForm() {
  const router = useRouter();
  const { acceptSession } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(60);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('platform-otp') ?? 'null') as Challenge | null;
      if (!saved?.challengeId || !saved.phone) { router.replace('/login'); return; }
      setChallenge(saved);
    } catch { router.replace('/login'); }
  }, [router]);
  useEffect(() => {
    if (!challenge) return;
    const tick = () => setRemaining(Math.max(0, 60 - Math.floor((Date.now() - challenge.sentAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  const verify = async () => {
    if (!challenge || busy) return;
    setBusy(true);
    try {
      const result = await authApi.verifyOtp(challenge.challengeId, code);
      sessionStorage.removeItem('platform-otp');
      acceptSession(result, challenge.intent);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Invalid code'); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    if (!challenge || busy || remaining) return;
    setBusy(true);
    try {
      const result = await authApi.requestOtp(challenge.phone, challenge.intent);
      const next = { ...challenge, challengeId: result.challengeId, sentAt: Date.now() };
      sessionStorage.setItem('platform-otp', JSON.stringify(next)); setChallenge(next); setCode('');
      toast.success('A new code was sent.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not send code'); }
    finally { setBusy(false); }
  };
  return <AuthLayout title="Verify OTP" subtitle={challenge ? `Code sent to ${challenge.phone}` : 'Loading…'}>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void verify(); }}>
      <Input aria-label="Six-digit code" autoComplete="one-time-code" inputMode="numeric" placeholder="6-digit OTP" value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        maxLength={6} disabled={busy || !challenge} className="h-14 border-white/10 bg-white/5 text-center text-2xl tracking-[0.4em] text-white" />
      <Button type="submit" disabled={busy || code.length !== 6 || !challenge} className="h-12 w-full gradient-primary border-0">{busy ? 'Please wait…' : 'Verify & Continue'}</Button>
      <Button type="button" variant="outline" onClick={() => void resend()} disabled={busy || remaining > 0 || !challenge} className="w-full">{remaining ? `Resend in ${remaining}s` : 'Resend OTP'}</Button>
      <Button type="button" variant="ghost" onClick={() => router.replace('/login')} className="w-full">Back to login</Button>
    </form>
  </AuthLayout>;
}
