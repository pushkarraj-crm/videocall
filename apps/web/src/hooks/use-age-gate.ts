'use client';

import { useEffect, useState } from 'react';
import { isAgeConfirmed } from '@/lib/legal/age-gate';

export function useAgeGate() {
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(true);

  useEffect(() => {
    setConfirmed(isAgeConfirmed());
    setReady(true);
  }, []);

  const confirm = () => setConfirmed(true);

  return { ready, confirmed, confirm };
}