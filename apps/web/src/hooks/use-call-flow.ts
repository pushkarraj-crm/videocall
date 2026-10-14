'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { callsApi } from '@/lib/api/calls';
import { useCallStore } from '@/stores/call-store';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { COINS_PER_MINUTE } from '@/lib/constants';
import { devLog } from '@/lib/dev-log';

async function ensureWalletCanCall(router: ReturnType<typeof useRouter>): Promise<boolean> {
  let wallet = useWalletStore.getState().wallet;
  if (!wallet) {
    await useWalletStore.getState().fetchWallet();
    wallet = useWalletStore.getState().wallet;
  }

  const hasFreeCall = (wallet?.freeCallsRemaining ?? 0) > 0;
  const hasCoins = (wallet?.balanceCoins ?? 0) >= COINS_PER_MINUTE;

  if (!hasFreeCall && !hasCoins) {
    router.push('/wallet/purchase');
    return false;
  }

  return true;
}

export function useCallFlow() {
  const router = useRouter();
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const callerId = useAuthStore((s) => s.session?.user?.id);

  const startMatchedCall = useCallback(async () => {
    if (!(await ensureWalletCanCall(router))) return;

    try {
      devLog('CALL_MATCH_START', { callerId });
      const call = await callsApi.match();
      devLog('CALL_MATCHED', {
        callId: call.callId,
        routing: call.routing,
        aiFallback: call.aiFallback,
      });
      setActiveCall({
        callId: call.callId,
        roomId: call.roomId,
        zego: call.zego,
        isFreeCall: call.isFreeCall,
        calleeId: call.matchedHostId,
        role: 'caller',
        coinsPerMinute: call.coinsPerMinute ?? COINS_PER_MINUTE,
        isVirtualHost: call.isVirtualHost,
        virtualHost: call.virtualHost,
        lockedVideoUrl: call.lockedVideoUrl,
        hostCallType: call.hostCallType ?? call.routing,
      });
      router.push(`/calls/${call.callId}`);
      return call;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No hosts available';
      if (message.toLowerCase().includes('insufficient') || message.toLowerCase().includes('enough coins')) {
        router.push('/wallet/purchase');
        return;
      }
      throw e;
    }
  }, [callerId, router, setActiveCall]);

  const startCall = useCallback(
    async (hostId: string) => {
      if (!(await ensureWalletCanCall(router))) return;

      try {
        devLog('CALL_INITIATE_START', { callerId, hostId });
        const call = await callsApi.initiate(hostId);
        devLog('CALL_CREATED', {
          callId: call.callId,
          roomId: call.roomId,
          callerId,
          hostId,
        });
        setActiveCall({
          callId: call.callId,
          roomId: call.roomId,
          zego: call.zego,
          isFreeCall: call.isFreeCall,
          calleeId: hostId,
          role: 'caller',
          coinsPerMinute: call.coinsPerMinute ?? COINS_PER_MINUTE,
          isVirtualHost: call.isVirtualHost,
          virtualHost: call.virtualHost,
          lockedVideoUrl: call.lockedVideoUrl,
          hostCallType: call.hostCallType,
        });
        router.push(`/calls/${call.callId}`);
        return call;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Cannot start call';
        if (message.toLowerCase().includes('insufficient') || message.toLowerCase().includes('enough coins')) {
          router.push('/wallet/purchase');
          return;
        }
        throw e;
      }
    },
    [callerId, router, setActiveCall],
  );

  return { startCall, startMatchedCall, initiate: startCall, loading: false };
}