'use client';

import { AgeGate } from '@/components/legal/age-gate';
import { useAgeGate } from '@/hooks/use-age-gate';

export function AgeGateShell({ children }: { children: React.ReactNode }) {
  const { ready, confirmed, confirm } = useAgeGate();

  if (!ready) return null;
  if (!confirmed) return <AgeGate onConfirmed={confirm} />;

  return <>{children}</>;
}