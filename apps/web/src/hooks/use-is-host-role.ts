'use client';

import { useAuthStore } from '@/stores/auth-store';

/** Host role from profile (preferred) or session JWT payload (available immediately after OAuth). */
export function useIsHostRole(): boolean {
  return useAuthStore((s) => {
    if (s.profile?.roles) return s.profile.roles.includes('host');
    return s.session?.user?.roles?.includes('host') ?? false;
  });
}