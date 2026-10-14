'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { setAuthIntent } from '@/lib/auth/intent';
import {
  DEV_LOGIN_PHONES,
  type DevLoginRole,
  isDevLoginRoutesEnabled,
} from '@/lib/auth/dev-login';

/**
 * Runs existing authApi.devLogin via useAuth.loginWithDev for a single role.
 * Only for /dev/login/* pages — not linked from public UI.
 */
export function DevLoginRunner({ role }: { role: DevLoginRole }) {
  const { loginWithDev } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!isDevLoginRoutesEnabled()) {
      setError('Not available');
      return;
    }

    const intent = role === 'admin' ? 'admin' : role === 'host' ? 'host' : 'user';
    setAuthIntent(intent);

    void (async () => {
      try {
        await loginWithDev(
          {
            phone: DEV_LOGIN_PHONES[role],
            role,
          },
          intent,
        );
        toast.success(`Signed in as ${role}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Dev login failed';
        setError(message);
        toast.error(message);
      }
    })();
  }, [loginWithDev, role]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-[#0F0F12] px-4 text-center">
        <p className="text-sm font-medium text-red-400">Development login failed</p>
        <p className="max-w-sm text-xs text-[#A7A7B3]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0F0F12] text-white">
      <Loader2 className="h-8 w-8 animate-spin text-[#FF6B9D]" />
      <p className="text-sm text-[#A7A7B3]">Signing in as {role}…</p>
    </div>
  );
}
