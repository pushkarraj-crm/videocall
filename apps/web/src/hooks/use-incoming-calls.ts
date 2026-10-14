'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { callsApi } from '@/lib/api/calls';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';
import { useIsHostRole } from '@/hooks/use-is-host-role';

function isOnActiveCallPage(pathname: string): boolean {
  return pathname.startsWith('/calls/') && !pathname.startsWith('/calls/incoming');
}

/**
 * Polls for host incoming calls for authenticated host accounts.
 * Updates call store only — does NOT auto-navigate to /calls/incoming.
 * Host Dashboard shows the live Accept/Decline panel via HostIncomingCallPanel.
 */
export function useIncomingCalls() {
  const pathname = usePathname();
  const isHost = useIsHostRole();
  const session = useAuthStore((s) => s.session);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const activeCall = useCallStore((s) => s.activeCall);
  const acceptingCallId = useCallStore((s) => s.acceptingCallId);
  const setIncomingCall = useCallStore((s) => s.setIncomingCall);
  const incomingCallRef = useRef(incomingCall);
  incomingCallRef.current = incomingCall;

  // Host accounts always receive incoming-call polls (role from session/DB, not a UI mode).
  const onActiveCallPage = isOnActiveCallPage(pathname);

  useEffect(() => {
    if (!session || !isHost || activeCall || acceptingCallId || onActiveCallPage) {
      return;
    }

    let cancelled = false;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const { calls } = await callsApi.incoming();
        if (cancelled) return;

        const { activeCall: currentActive, acceptingCallId: currentAccepting } =
          useCallStore.getState();
        if (currentActive || currentAccepting) return;

        if (calls.length === 0) {
          if (incomingCallRef.current) {
            setIncomingCall(null);
          }
          return;
        }

        const latest = calls[0];
        if (!incomingCallRef.current || incomingCallRef.current.callId !== latest.callId) {
          setIncomingCall({
            callId: latest.callId,
            callerId: latest.callerId,
            callerName: latest.callerName,
          });
          // Stay on current host page (e.g. dashboard) — UI panel handles Accept/Decline
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('HOST_INCOMING_POLL_ERROR', {
            hostId: session.user.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) {
          // The SSE notification stream delivers new calls immediately. This slower
          // poll repairs state after a reconnect without issuing a query every 3s.
          timer = setTimeout(poll, 30_000 + Math.random() * 10_000);
        }
      }
    };

    // Spread clients across the first few seconds after a page load.
    timer = setTimeout(poll, Math.random() * 5_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    session,
    isHost,
    pathname,
    activeCall,
    acceptingCallId,
    onActiveCallPage,
    setIncomingCall,
  ]);
}
