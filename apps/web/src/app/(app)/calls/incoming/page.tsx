'use client';

import { useEffect, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/page-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { useCallStore } from '@/stores/call-store';
import { useAuthStore } from '@/stores/auth-store';
import { callsApi } from '@/lib/api/calls';
import { useIncomingCallActions } from '@/hooks/use-incoming-call-actions';

/**
 * Legacy route kept for deep links / notifications.
 * Primary host UX is the live panel on /host/dashboard (no auto-redirect here).
 */
export default function IncomingCallPage() {
  const router = useRouter();
  const hostId = useAuthStore((s) => s.session?.user?.id);
  const incoming = useCallStore((s) => s.incomingCall);
  const setIncoming = useCallStore((s) => s.setIncomingCall);
  const { accept, decline, loading } = useIncomingCallActions();
  const [hydrating, setHydrating] = useState(!incoming);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { calls } = await callsApi.incoming();
        if (cancelled) return;

        if (calls.length === 0) {
          setIncoming(null);
          setHydrating(false);
          return;
        }

        const latest = calls[0];
        setIncoming({
          callId: latest.callId,
          callerId: latest.callerId,
          callerName: latest.callerName,
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('HOST_INCOMING_FETCH_ERROR', {
            hostId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hostId, setIncoming]);

  if (hydrating) {
    return <PageLoader variant="generic" />;
  }

  if (!incoming) {
    return (
      <div className="premium-glow-bg flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <EmptyState
          icon={Phone}
          title="No incoming calls"
          description="Incoming calls appear on your Host Dashboard. You’ll be notified when someone calls."
        />
        <Button
          variant="outline"
          className="cursor-pointer border-white/12"
          onClick={() => router.replace('/host/dashboard')}
        >
          Back to Host Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute inset-0 gradient-primary opacity-90" />
      <Card className="premium-glass relative z-10 w-full max-w-sm animate-slide-up border-0 text-center shadow-2xl">
        <CardContent className="space-y-6 p-8">
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 animate-pulse-ring rounded-full bg-[#FF2E74]/30" />
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full gradient-primary text-3xl font-bold text-white shadow-[0_8px_32px_rgba(255,46,116,0.4)]">
              {incoming.callerName[0]}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{incoming.callerName}</h2>
            <p className="mt-1 text-sm text-[#A7A7B3]">Incoming video call</p>
          </div>
          <div className="flex justify-center gap-10">
            <Button
              size="icon"
              variant="destructive"
              className="press-scale h-16 w-16 cursor-pointer rounded-full shadow-lg disabled:cursor-not-allowed"
              onClick={() => void decline(incoming.callId)}
              disabled={loading}
              aria-label="Reject call"
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
            <Button
              size="icon"
              variant="gradient"
              className="press-scale h-16 w-16 cursor-pointer rounded-full animate-match-pulse disabled:cursor-not-allowed"
              onClick={() => void accept(incoming)}
              disabled={loading}
              loading={loading}
              aria-label="Accept call"
            >
              <Phone className="h-7 w-7" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
