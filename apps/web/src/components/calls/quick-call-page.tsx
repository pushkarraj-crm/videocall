'use client';

import { useCallback, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MatchQueue } from '@/components/match/match-queue';
import { Button } from '@/components/ui/button';
import { useCallFlow } from '@/hooks/use-call-flow';
import { FREE_CALL_LIMIT } from '@/lib/constants';
import { useWallet } from '@/hooks/use-wallet';

type MatchState = 'idle' | 'searching' | 'found' | 'error';

interface QuickCallPageProps {
  title: string;
  description: string;
  ctaLabel: string;
  icon: LucideIcon;
}

export function QuickCallPage({ title, description, ctaLabel, icon: Icon }: QuickCallPageProps) {
  const [state, setState] = useState<MatchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const { startMatchedCall } = useCallFlow();
  const { wallet } = useWallet();
  const startingRef = useRef(false);

  const startMatch = useCallback(async () => {
    // Prevent double-create from rapid clicks / re-renders
    if (startingRef.current || state === 'searching' || state === 'found') return;
    startingRef.current = true;
    setState('searching');
    setError(null);
    try {
      await startMatchedCall();
      setState('found');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Could not start call');
    } finally {
      startingRef.current = false;
    }
  }, [startMatchedCall, state]);

  const freeLeft = wallet?.freeCallsRemaining ?? FREE_CALL_LIMIT;

  return (
    <div className="premium-glow-bg flex min-h-[75vh] flex-col items-center justify-center gap-8 px-4 text-center">
      {state === 'idle' && (
        <>
          <div className="relative">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#FF2E74]/25" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full gradient-primary shadow-[0_12px_48px_rgba(255,46,116,0.4)]">
              <Icon className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="max-w-xs text-sm text-[#A7A7B3]">{description}</p>
            {freeLeft > 0 ? (
              <p className="text-sm font-medium text-[#FFB347]">{freeLeft} free calls remaining</p>
            ) : (
              <p className="text-sm text-[#A7A7B3]">5 coins per minute after free quota</p>
            )}
          </div>
          <Button
            size="lg"
            className="animate-match-pulse h-14 w-52 rounded-full border-0 gradient-primary text-lg font-semibold shadow-[0_8px_32px_rgba(255,46,116,0.4)]"
            onClick={() => void startMatch()}
            disabled={state !== 'idle'}
          >
            {ctaLabel}
          </Button>
        </>
      )}

      {(state === 'searching' || state === 'found') && (
        <MatchQueue status={state === 'found' ? 'found' : 'searching'} />
      )}

      {state === 'error' && (
        <div className="premium-card max-w-sm space-y-4 p-6">
          <p className="text-[#FF2E74]">{error}</p>
          <Button
            onClick={() => setState('idle')}
            className="rounded-full gradient-primary border-0"
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}