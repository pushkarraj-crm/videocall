'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { callsApi } from '@/lib/api/calls';
import { ApiClientError } from '@/lib/api/client';
import { COINS_PER_MINUTE } from '@/lib/constants';
import { useCallStore } from '@/stores/call-store';

/**
 * Shared accept / decline handlers for host incoming calls.
 * Reused by Host Dashboard panel and /calls/incoming page — same API/call flow.
 */
export function useIncomingCallActions() {
  const router = useRouter();
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const setIncoming = useCallStore((s) => s.setIncomingCall);
  const setAcceptingCallId = useCallStore((s) => s.setAcceptingCallId);
  const [loading, setLoading] = useState(false);

  const accept = useCallback(
    async (incoming: { callId: string; callerId: string; callerName: string }) => {
      setLoading(true);
      setAcceptingCallId(incoming.callId);
      setIncoming(null);
      try {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          /* permission prompt may still appear during the call */
        }
        await callsApi.consent(incoming.callId, '1.0');

        type AcceptResult = {
          call: { zegoRoomId: string; isFreeCall: boolean };
          zego: { token: string; appId: string; roomId: string };
        };
        let result: AcceptResult | null = null;

        for (let attempt = 0; attempt < 60; attempt += 1) {
          try {
            result = (await callsApi.accept(incoming.callId)) as AcceptResult;
            break;
          } catch (err) {
            const code = err instanceof ApiClientError ? err.code : undefined;
            if (code === 'CONSENT_REQUIRED') {
              await new Promise((resolve) => setTimeout(resolve, 500));
              continue;
            }
            throw err;
          }
        }

        if (!result) {
          throw new Error('Caller has not consented yet');
        }
        setActiveCall({
          callId: incoming.callId,
          roomId: result.call.zegoRoomId,
          zego: result.zego,
          isFreeCall: result.call.isFreeCall,
          callerId: incoming.callerId,
          role: 'callee',
          coinsPerMinute: COINS_PER_MINUTE,
          consented: true,
        });
        router.replace(`/calls/${incoming.callId}`);
      } catch (err) {
        setAcceptingCallId(null);
        toast.error(err instanceof Error ? err.message : 'Could not accept call');
      } finally {
        setLoading(false);
        setAcceptingCallId(null);
      }
    },
    [router, setAcceptingCallId, setActiveCall, setIncoming],
  );

  const decline = useCallback(
    async (callId: string) => {
      setLoading(true);
      try {
        await callsApi.reject(callId);
        setIncoming(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not reject call');
      } finally {
        setLoading(false);
      }
    },
    [setIncoming],
  );

  return { accept, decline, loading };
}
