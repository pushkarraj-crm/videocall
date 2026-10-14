'use client';

import { useEffect, useRef } from 'react';
import { hostsApi } from '@/lib/api/hosts';

const HEARTBEAT_INTERVAL_MS = 20_000;

export function useHostHeartbeat(isOnline: boolean, isBusy: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isOnline || isBusy) return;

    const ping = () => {
      hostsApi.heartbeat().catch(() => undefined);
    };

    ping();
    timerRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOnline, isBusy]);
}