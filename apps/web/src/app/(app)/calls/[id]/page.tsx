'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCallStore } from '@/stores/call-store';
import { getHomeHref } from '@/stores/role-mode-store';
import { VideoCallRoom } from '@/components/calls/video-call-room';
import { CallConsentScreen } from '@/components/calls/call-consent-screen';
import { CallEndedScreen } from '@/components/calls/call-ended-screen';
import { RatingPopup } from '@/components/reviews/rating-popup';
import { callsApi } from '@/lib/api/calls';
import { reviewsApi } from '@/lib/api/reviews';
import { useAuthStore } from '@/stores/auth-store';
import { useIsHostRole } from '@/hooks/use-is-host-role';
import { COINS_PER_MINUTE } from '@/lib/constants';
import { CALL_TERMINAL_STATUSES } from '@/lib/calls/wait-for-call-active';
import { ApiClientError } from '@/lib/api/client';
import { devLog } from '@/lib/dev-log';

export default function VideoCallPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const activeCall = useCallStore((s) => s.activeCall);
  const acceptingCallId = useCallStore((s) => s.acceptingCallId);
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const isHost = useIsHostRole();
  const [consented, setConsented] = useState(
    () => (activeCall?.callId === id && activeCall.consented) ?? false,
  );
  const [hydrating, setHydrating] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [callMissing, setCallMissing] = useState(false);
  const [unanswered, setUnanswered] = useState(false);
  const sessionEndedRef = useRef(false);
  const exitingRef = useRef(false);
  const [exiting, setExiting] = useState(false);
  const [ratingPrompt, setRatingPrompt] = useState<{
    callId: string;
    hostName: string | null;
  } | null>(null);
  const homeHref = getHomeHref(isHost);

  /**
   * User accounts skip the intermediate "Call Ended" UI only after a genuine end
   * (sessionEnded / callMissing). Do NOT treat temporary missing activeCall during
   * auth/call hydration as an ended call — that was bouncing users home immediately.
   */
  const shouldSkipEndedScreen =
    !isHost && !unanswered && (sessionEnded || callMissing);

  useEffect(() => {
    if (!shouldSkipEndedScreen) return;
    devLog('CALL_PAGE_REDIRECT_HOME', { id, sessionEnded, callMissing });
    router.replace('/home');
  }, [shouldSkipEndedScreen, router, id, sessionEnded, callMissing]);

  // Hydrate call from store or API — wait for auth session userId when possible.
  useEffect(() => {
    if (sessionEndedRef.current) return;

    // Wait for auth store rehydration so we don't treat userId=null as fatal.
    if (!hasHydrated) return;

    if (activeCall && activeCall.callId === id) {
      setHydrating(false);
      if (activeCall.consented) setConsented(true);
      return;
    }

    // Accepting host may not have activeCall yet — keep loading.
    if (acceptingCallId === id) {
      setHydrating(true);
      return;
    }

    if (!userId) {
      // Auth hydrated but no user — cannot load call.
      setHydrating(false);
      setCallMissing(true);
      return;
    }

    let cancelled = false;
    setHydrating(true);

    (async () => {
      try {
        const call = await callsApi.getCall(id);
        if (cancelled || sessionEndedRef.current) return;

        if (CALL_TERMINAL_STATUSES.has(call.status)) {
          // Unanswered timeout/reject while never active → stay and show ended/unanswered UI
          // instead of silently bouncing mid-load.
          const neverAnswered = call.status !== 'active' && !call.startedAt;
          sessionEndedRef.current = true;
          if (neverAnswered && call.callerId === userId) {
            setUnanswered(true);
          }
          setSessionEnded(true);
          setHydrating(false);
          return;
        }

        setActiveCall({
          callId: call.id,
          roomId: call.zegoRoomId,
          zego: call.zego,
          isFreeCall: call.isFreeCall,
          role: call.callerId === userId ? 'caller' : 'callee',
          calleeId: call.calleeId,
          callerId: call.callerId,
          coinsPerMinute: (call as { coinsPerMinute?: number }).coinsPerMinute ?? COINS_PER_MINUTE,
          isVirtualHost: call.isVirtualHost,
          virtualHost: call.virtualHost,
          lockedVideoUrl: (call as { lockedVideoUrl?: string | null }).lockedVideoUrl,
          hostCallType: (call as { hostCallType?: 'REAL_HOST' | 'AI_HOST' }).hostCallType,
          consented: (call as { hasConsented?: boolean }).hasConsented,
        });
        if ((call as { hasConsented?: boolean }).hasConsented) {
          setConsented(true);
        }
      } catch (err) {
        if (cancelled || sessionEndedRef.current) return;
        const code = err instanceof ApiClientError ? err.code : undefined;
        if (code === 'CALL_NOT_FOUND' || (err instanceof ApiClientError && err.statusCode === 404)) {
          setCallMissing(true);
        }
      } finally {
        if (!cancelled && !sessionEndedRef.current) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCall, acceptingCallId, hasHydrated, id, setActiveCall, userId]);

  // Leaving the call — never show infinite "Loading call" after End.
  if (exiting || exitingRef.current) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0F0F12]">
        <p className="text-muted-foreground">Returning home…</p>
      </div>
    );
  }

  if (!hasHydrated || hydrating) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0F0F12]">
        <p className="text-muted-foreground">Loading call…</p>
      </div>
    );
  }

  // USER: redirecting to Discover after a genuine ended session
  if (shouldSkipEndedScreen) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0F0F12]">
        <p className="text-muted-foreground">Returning to Discover…</p>
      </div>
    );
  }

  // Unanswered ring timeout / host never joined — do not auto-bounce without message
  if (unanswered || (sessionEnded && !isHost)) {
    return (
      <CallEndedScreen
        homeHref={homeHref}
        discoverHref="/home"
        title={unanswered ? 'Host did not answer' : 'Call Ended'}
        message={
          unanswered
            ? 'No host accepted in time. Try again or pick another host.'
            : 'This session has finished.'
        }
        onStartNewCall={() => router.replace('/video-call')}
      />
    );
  }

  if (sessionEnded || callMissing) {
    return <CallEndedScreen homeHref={homeHref} discoverHref="/home" />;
  }

  if (acceptingCallId === id && (!activeCall || activeCall.callId !== id)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0F0F12]">
        <p className="text-muted-foreground">Joining call…</p>
      </div>
    );
  }

  if (!activeCall || activeCall.callId !== id) {
    // End Call clears activeCall before route change — never spin forever.
    if (sessionEndedRef.current || exitingRef.current || exiting) {
      return (
        <div className="flex h-dvh items-center justify-center bg-[#0F0F12]">
          <p className="text-muted-foreground">Returning home…</p>
        </div>
      );
    }
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0F0F12]">
        <p className="text-muted-foreground">Loading call…</p>
      </div>
    );
  }

  if (!consented) {
    return (
      <CallConsentScreen
        callId={id}
        onConsent={() => {
          setConsented(true);
          useCallStore.getState().setActiveCall({
            ...activeCall,
            consented: true,
          });
        }}
        onCancel={async () => {
          try {
            await callsApi.end(id);
          } catch {
            /* ignore */
          }
          useCallStore.getState().setActiveCall(null);
          router.push(homeHref);
        }}
      />
    );
  }

  const goHome = () => {
    const target = isHost ? homeHref : '/home';
    router.replace(target);
  };

  const exitAfterCall = () => {
    setRatingPrompt(null);
    exitingRef.current = true;
    setExiting(true);
    goHome();
  };

  /**
   * End call from VideoCallRoom.
   * Navigate immediately — never block on reviews/API.
   */
  const handleCallEnd = (opts?: { unanswered?: boolean }) => {
    if (exitingRef.current && !opts?.unanswered) return;
    sessionEndedRef.current = true;

    if (opts?.unanswered) {
      useCallStore.getState().setActiveCall(null);
      setUnanswered(true);
      setSessionEnded(true);
      return;
    }

    const endedCallId = activeCall?.callId ?? id;
    const wasCaller = activeCall?.role === 'caller';

    exitingRef.current = true;
    setExiting(true);
    useCallStore.getState().setActiveCall(null);
    useCallStore.getState().setAcceptingCallId(null);

    // Users go home immediately (no intermediate ended screen).
    // Optional rating is skipped on end to avoid blocking — can be added via history later.
    if (wasCaller) {
      // Fire-and-forget eligibility; do not delay home.
      void reviewsApi.eligibility(endedCallId).catch(() => undefined);
    }

    // Failsafe: always leave call UI within a short window.
    goHome();
    window.setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/calls/')) {
        router.replace(isHost ? homeHref : '/home');
      }
    }, 800);
  };

  return (
    <>
      <VideoCallRoom
        callId={activeCall.callId}
        roomId={activeCall.roomId}
        role={activeCall.role}
        reportedUserId={
          activeCall.role === 'caller' ? activeCall.calleeId : activeCall.callerId
        }
        zego={activeCall.zego}
        isFreeCall={activeCall.isFreeCall}
        isVirtualHost={activeCall.isVirtualHost}
        virtualHost={activeCall.virtualHost}
        lockedVideoUrl={activeCall.lockedVideoUrl}
        coinsPerMinute={activeCall.coinsPerMinute ?? COINS_PER_MINUTE}
        onEnd={handleCallEnd}
      />
      {ratingPrompt && (
        <RatingPopup
          callId={ratingPrompt.callId}
          hostName={ratingPrompt.hostName}
          onClose={exitAfterCall}
          onSubmitted={exitAfterCall}
        />
      )}
    </>
  );
}
