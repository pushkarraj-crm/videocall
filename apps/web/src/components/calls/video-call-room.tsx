'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag } from 'lucide-react';
import { ReportUserDialog } from '@/components/reports/report-user-dialog';
import { toast } from 'sonner';
import { CallControls } from '@/components/calls/call-controls';
import { GiftAnimationLayer } from '@/components/gifts/gift-animation-layer';
import { GiftComboBadge } from '@/components/gifts/gift-combo-badge';
import { GiftStoreSheet } from '@/components/gifts/gift-store-sheet';
import { RechargeSheet } from '@/components/gifts/recharge-sheet';
import { Button } from '@/components/ui/button';
import { callsApi } from '@/lib/api/calls';
import { giftsApi } from '@/lib/api/gifts';
import type { GiftCatalogItem, GiftSentEvent } from '@/lib/gifts/types';
import { CALL_TERMINAL_STATUSES } from '@/lib/calls/wait-for-call-active';
import { startLocalCameraPreview } from '@/lib/calls/start-local-camera-preview';
import { FREE_CALL_MAX_SECONDS } from '@/lib/constants';
import {
  joinZegoRoom,
  leaveZegoRoom,
  setZegoCameraEnabled,
  setZegoMicrophoneMuted,
  ZEGO_UNAVAILABLE_USER_MESSAGE,
  type ZegoEngine,
} from '@/lib/zego/client';
import { ErrorState } from '@/components/shared/error-state';
import { logBackgroundApiFailure } from '@/lib/api/background';
import { devLog } from '@/lib/dev-log';
import { formatDuration } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';
import { useWalletStore } from '@/stores/wallet-store';
import { VirtualHostOverlay } from '@/components/calls/virtual-host-overlay';
import { useVirtualHostConversation } from '@/hooks/use-virtual-host-conversation';
import type { VirtualHostMeta } from '@/types/api';

interface VideoCallRoomProps {
  callId: string;
  roomId: string;
  role: 'caller' | 'callee';
  reportedUserId?: string;
  reportedUserName?: string;
  zego: { token: string; appId: string; roomId: string; userId?: string };
  isFreeCall: boolean;
  isVirtualHost?: boolean;
  virtualHost?: VirtualHostMeta;
  lockedVideoUrl?: string | null;
  coinsPerMinute?: number;
  /** Called when the call session should leave the room UI. unanswered = host never accepted. */
  onEnd: (opts?: { unanswered?: boolean }) => void;
  onRecharge?: () => void;
}

export function VideoCallRoom({
  callId,
  roomId,
  role,
  reportedUserId,
  reportedUserName,
  zego,
  isFreeCall,
  isVirtualHost = false,
  virtualHost,
  lockedVideoUrl,
  coinsPerMinute = 5,
  onEnd,
  onRecharge,
}: VideoCallRoomProps) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const displayName = useAuthStore((s) => s.session?.user.displayName ?? 'User');
  const incomingCall = useCallStore((s) => s.incomingCall);
  const isHost = useAuthStore((s) => s.profile?.roles?.includes('host') ?? false);

  const partnerName =
    role === 'caller'
      ? virtualHost?.displayName ?? reportedUserName ?? 'Host'
      : reportedUserName ?? incomingCall?.callerName ?? 'Caller';

  const wallet = useWalletStore((s) => s.wallet);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ZegoEngine | null>(null);
  const joinGenerationRef = useRef(0);
  /** Monotonic session id — bumped on every cleanup so stale join results are ignored. */
  const sessionIdRef = useRef(0);
  const joinInProgressRef = useRef(false);
  const alreadyJoinedRef = useRef(false);
  const navigatedAwayRef = useRef(false);
  const lastBilledMinuteRef = useRef(0);
  const callActiveRef = useRef(role === 'callee');
  const endingRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const endToastShownRef = useRef(false);
  const mountedRef = useRef(true);
  const handleEndRef = useRef<() => Promise<void>>(async () => {});
  const handleRemoteEndRef = useRef<() => Promise<void>>(async () => {});
  const zegoRef = useRef(zego);
  zegoRef.current = zego;
  const previewCleanupRef = useRef<(() => void) | null>(null);

  const [hostAccepted, setHostAccepted] = useState(role === 'callee' || isVirtualHost);
  const [connected, setConnected] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [serverCallActive, setServerCallActive] = useState(role === 'callee' || isVirtualHost);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [giftSending, setGiftSending] = useState(false);
  const [giftStoreOpen, setGiftStoreOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [lowBalanceMode, setLowBalanceMode] = useState(false);
  const lowBalanceWarnedRef = useRef(false);
  const [giftEvents, setGiftEvents] = useState<GiftSentEvent[]>([]);
  const seenGiftIdsRef = useRef(new Set<string>());
  const [combo, setCombo] = useState<{ giftId: string; icon: string; count: number } | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFeedAtRef = useRef<string>(new Date(0).toISOString());
  const [error, setError] = useState<string | null>(null);
  /** CONNECTING | CONNECTED | FAILED — never CONNECTED after Zego auth failure. */
  const [connectionPhase, setConnectionPhase] = useState<'idle' | 'connecting' | 'connected' | 'failed'>(
    'idle',
  );
  const [errorCode, setErrorCode] = useState<string | null>(null);
  /** Bump to re-run Zego join after a connection failure without ending the business call. */
  const [joinRetry, setJoinRetry] = useState(0);
  const [giftReaction, setGiftReaction] = useState<{
    message?: string;
    animation?: string;
    expression?: string;
    category?: string;
    animationTier?: string;
  } | null>(null);
  const [avatarCallEvent, setAvatarCallEvent] = useState<string | null>(null);

  const waitingForHost = !isVirtualHost && role === 'caller' && !hostAccepted;
  const showOnline =
    connected || (isVirtualHost && serverCallActive && !waitingForHost);
  const balance = wallet?.balanceCoins ?? 0;
  const giftsEnabled = serverCallActive && connected;

  const conversationEnabled = isVirtualHost && role === 'caller' && serverCallActive;
  const conversation = useVirtualHostConversation({
    callId,
    enabled: conversationEnabled,
  });

  const teardownEngine = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engineRef.current = null;
    alreadyJoinedRef.current = false;
    joinInProgressRef.current = false;
    const effectiveRoomId = engine.joinedRoomId || roomId;
    // Fire-and-forget — never block End Call navigation on Zego leave.
    void leaveZegoRoom(engine, effectiveRoomId).catch(() => undefined);
  }, [roomId]);

  /** Idempotent local session cleanup (media, Zego, timers). Safe to call multiple times. */
  const cleanupOnce = useCallback(
    (source: 'local' | 'remote') => {
      if (isCleaningUpRef.current) return false;
      isCleaningUpRef.current = true;
      endingRef.current = true;
      // Invalidate any in-flight join / async join result.
      sessionIdRef.current += 1;
      joinGenerationRef.current += 1;
      joinInProgressRef.current = false;
      alreadyJoinedRef.current = false;
      devLog('CALL_ENDED', { callId, role, source });

      if (comboTimerRef.current) {
        clearTimeout(comboTimerRef.current);
        comboTimerRef.current = null;
      }
      previewCleanupRef.current?.();
      previewCleanupRef.current = null;

      if (isVirtualHost) {
        try {
          conversation.interrupt();
        } catch {
          /* ignore */
        }
      }

      teardownEngine();
      if (mountedRef.current) {
        setConnected(false);
        setRemoteConnected(false);
        setServerCallActive(false);
      }
      return true;
    },
    [callId, conversation, isVirtualHost, role, teardownEngine],
  );

  const exitCall = useCallback(
    (opts?: { unanswered?: boolean }) => {
      if (navigatedAwayRef.current) return;
      if (!isCleaningUpRef.current) return;
      navigatedAwayRef.current = true;
      onEnd(opts);
    },
    [onEnd],
  );

  const handleRemoteEnd = useCallback(async () => {
    // Unanswered ring (host never accepted) — not a mid-call hangup.
    if (!callActiveRef.current && role === 'caller' && !isVirtualHost) {
      if (!cleanupOnce('remote')) return;
      devLog('CALL_UNANSWERED', { callId, role });
      if (mountedRef.current) {
        setError('Host did not answer. Please try again.');
      }
      exitCall({ unanswered: true });
      return;
    }

    if (!cleanupOnce('remote')) return;
    if (!endToastShownRef.current) {
      endToastShownRef.current = true;
      toast.info('Call ended');
    }
    exitCall();
  }, [callId, cleanupOnce, exitCall, isVirtualHost, role]);

  /**
   * End call: local cleanup + navigate immediately.
   * Backend end / wallet refresh run in background — never block Home navigation.
   */
  const handleEnd = useCallback(async () => {
    if (!cleanupOnce('local')) return;

    if (isVirtualHost && conversationEnabled) {
      setAvatarCallEvent('call_ending');
      void conversation.sendEvent('call_ending').catch(() => undefined);
    }

    // Navigate first — do not await network.
    exitCall();

    void callsApi.end(callId).catch(() => undefined);
    void fetchWallet().catch(() => undefined);
  }, [
    callId,
    cleanupOnce,
    conversation,
    conversationEnabled,
    exitCall,
    fetchWallet,
    isVirtualHost,
  ]);

  handleEndRef.current = handleEnd;
  handleRemoteEndRef.current = handleRemoteEnd;

  const handleLeave = useCallback(async () => {
    // From error UI: leave without treating as a remote hangup toast.
    if (error && !callActiveRef.current) {
      if (!cleanupOnce('local')) return;
      exitCall({ unanswered: true });
      void callsApi.end(callId).catch(() => undefined);
      return;
    }
    await handleEnd();
  }, [callId, cleanupOnce, error, exitCall, handleEnd]);

  const applyCallStatus = useCallback(
    (status: string) => {
      if (CALL_TERMINAL_STATUSES.has(status)) {
        if (!callActiveRef.current && role === 'caller' && !isVirtualHost) {
          if (mountedRef.current && !endingRef.current) {
            setError('Host did not answer. Please try again.');
          }
          return 'unanswered' as const;
        }
        if (mountedRef.current && !endingRef.current && !isVirtualHost && !callActiveRef.current) {
          setError('Host did not answer. Please try again.');
        }
        return 'terminal' as const;
      }
      if (status === 'active') {
        if (!hostAccepted) {
          devLog('HOST_ACCEPTED', { callId, role });
          devLog('CALL_ACCEPTED', { callId, role });
        }
        callActiveRef.current = true;
        setHostAccepted(true);
        setServerCallActive(true);
        if (isVirtualHost && role === 'caller') setAvatarCallEvent('user_joined');
        return 'active' as const;
      }
      return 'pending' as const;
    },
    [callId, hostAccepted, isVirtualHost, role],
  );

  useEffect(() => {
    mountedRef.current = true;
    endingRef.current = false;
    isCleaningUpRef.current = false;
    endToastShownRef.current = false;
    navigatedAwayRef.current = false;
    joinGenerationRef.current = 0;
    joinInProgressRef.current = false;
    alreadyJoinedRef.current = false;
    sessionIdRef.current += 1;
    return () => {
      mountedRef.current = false;
      // Do not force isCleaningUp here — Strict Mode remount must be able to join again.
    };
  }, [callId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Local camera preview — starts immediately, does not wait for host accept
  useEffect(() => {
    if (isCleaningUpRef.current || endingRef.current || !localRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const { cleanup } = await startLocalCameraPreview(localRef.current!);
        if (cancelled) {
          cleanup();
          return;
        }
        previewCleanupRef.current = cleanup;
        devLog('LOCAL_CAMERA_STARTED', { callId, role });
      } catch (err) {
        console.warn('LOCAL_CAMERA_FAILED', { callId, role, error: String(err) });
      }
    })();

    return () => {
      cancelled = true;
      previewCleanupRef.current?.();
      previewCleanupRef.current = null;
    };
  }, [callId, role]);

  // Call transitions arrive over the shared notification stream. A slow repair
  // check covers missed events after a reconnect or a stream starting late.
  useEffect(() => {
    if (isCleaningUpRef.current || endingRef.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const applyStatus = (status: string) => {
      if (CALL_TERMINAL_STATUSES.has(status)) {
        devLog('CALL_ENDED_SYNC', { callId, role, status, wasActive: callActiveRef.current });
        void handleRemoteEndRef.current();
        return;
      }

      if (role === 'caller') {
        const result = applyCallStatus(status);
        if (result === 'unanswered' || result === 'terminal') {
          void handleRemoteEndRef.current();
        }
      } else if (status === 'active') {
        callActiveRef.current = true;
        setServerCallActive(true);
      }
    };

    const onCallStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ callId: string; status: string }>).detail;
      if (detail?.callId === callId) applyStatus(detail.status);
    };

    const check = async () => {
      if (!mountedRef.current || isCleaningUpRef.current || endingRef.current) return;
      try {
        const call = await callsApi.getCall(callId);
        if (!cancelled && mountedRef.current && !isCleaningUpRef.current && !endingRef.current) {
          applyStatus(call.status);
        }
      } catch (err) {
        logBackgroundApiFailure(`/calls/${callId}`, err);
      } finally {
        if (!cancelled && !isCleaningUpRef.current && !endingRef.current) {
          timer = setTimeout(check, 30_000 + Math.random() * 15_000);
        }
      }
    };

    window.addEventListener('platform:call-status', onCallStatus);
    timer = setTimeout(check, Math.random() * 3_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('platform:call-status', onCallStatus);
    };
  }, [applyCallStatus, callId, role]);

  // ── AI Host: no Zego RTC ──────────────────────────────────────────────
  // Virtual hosts render via VirtualHostOverlay (locked video + conversation).
  // Joining Zego for AI only produced ZEGO_LOGIN_FAILED noise while the UI
  // still looked "connected" via serverCallActive. Skip Zego entirely for AI.
  useEffect(() => {
    if (!isVirtualHost) return;
    if (isCleaningUpRef.current || endingRef.current) return;
    if (!serverCallActive && !hostAccepted) return;

    alreadyJoinedRef.current = true;
    if (mountedRef.current) {
      setConnected(true);
      setRemoteConnected(true);
      setConnectionPhase('connected');
      setError(null);
      setErrorCode(null);
    }
    devLog('AI_HOST_CONNECTED_NO_ZEGO', { callId, role });
  }, [isVirtualHost, serverCallActive, hostAccepted, callId, role]);

  // ── Real Host: Zego join exactly once per call session ────────────────
  useEffect(() => {
    if (isVirtualHost) return;
    if (!userId || !hostAccepted || isCleaningUpRef.current || endingRef.current) return;
    if (alreadyJoinedRef.current || joinInProgressRef.current) return;
    if (engineRef.current?.roomLoginConfirmed) {
      alreadyJoinedRef.current = true;
      return;
    }

    let cancelled = false;
    const generation = ++joinGenerationRef.current;
    const sessionId = sessionIdRef.current;
    joinInProgressRef.current = true;
    setConnectionPhase('connecting');
    setError(null);
    setErrorCode(null);

    devLog('JOIN_ROOM', { callId, role, roomId, generation, userId, sessionId });

    (async () => {
      let joinConfig = {
        appId: Number(zegoRef.current.appId),
        token: zegoRef.current.token,
        roomId: zegoRef.current.roomId || roomId,
        tokenUserId: zegoRef.current.userId as string | undefined,
      };

      try {
        const freshCall = await callsApi.getCall(callId);
        if (
          cancelled ||
          generation !== joinGenerationRef.current ||
          sessionId !== sessionIdRef.current ||
          endingRef.current
        ) {
          return;
        }
        if (CALL_TERMINAL_STATUSES.has(freshCall.status)) {
          devLog('ZEGO_JOIN_SKIP_TERMINAL', { callId, status: freshCall.status });
          return;
        }
        joinConfig = {
          appId: Number(freshCall.zego.appId),
          token: freshCall.zego.token,
          roomId: freshCall.zego.roomId || freshCall.zegoRoomId || roomId,
          tokenUserId: (freshCall.zego as { userId?: string }).userId,
        };
        devLog('ZEGO_TOKEN_REFRESHED', {
          callId,
          role,
          roomId: joinConfig.roomId,
          appId: joinConfig.appId,
          tokenUserId: joinConfig.tokenUserId,
          sessionUserId: userId,
          tokenPresent: Boolean(joinConfig.token),
          tokenLen: joinConfig.token?.length ?? 0,
        });
      } catch {
        devLog('ZEGO_TOKEN_REFRESH_FALLBACK', { callId, role });
      }

      if (
        cancelled ||
        generation !== joinGenerationRef.current ||
        sessionId !== sessionIdRef.current ||
        endingRef.current
      ) {
        return;
      }

      const zegoUserId = joinConfig.tokenUserId || userId;
      if (!zegoUserId || !joinConfig.token || !joinConfig.roomId) {
        if (mountedRef.current && !endingRef.current) {
          setError('Missing call credentials. Please try again.');
        }
        return;
      }
      if (!Number.isFinite(joinConfig.appId) || joinConfig.appId <= 0) {
        if (mountedRef.current && !endingRef.current) {
          setError('Invalid Zego App ID configuration. Please contact support.');
        }
        return;
      }

      devLog('ZEGO_JOIN_ATTEMPT', {
        callId,
        role,
        appId: joinConfig.appId,
        roomId: joinConfig.roomId,
        zegoUserId,
        tokenLen: joinConfig.token.length,
        sessionId,
      });

      const {
        engine,
        joined,
        error: joinError,
        errorCode: joinErrorCode,
        publishWarning,
      } = await joinZegoRoom({
        appId: joinConfig.appId,
        token: joinConfig.token,
        roomId: joinConfig.roomId,
        userId: zegoUserId,
        userName: displayName || zegoUserId,
        role,
        localVideo: localRef.current,
        remoteVideo: remoteRef.current,
        onRemoteHangup: () => {
          void (async () => {
            if (isCleaningUpRef.current || endingRef.current) return;
            try {
              const call = await callsApi.getCall(callId);
              if (call.status === 'active' && !CALL_TERMINAL_STATUSES.has(call.status)) {
                devLog('ZEGO_HANGUP_IGNORED', { callId, role, status: call.status });
                return;
              }
            } catch {
              /* poll will sync */
            }
            void handleRemoteEndRef.current();
          })();
        },
        onRemoteStream: () => {
          if (mountedRef.current && !endingRef.current) setRemoteConnected(true);
        },
      });

      // Stale session — abandon result without error overlay noise.
      if (
        cancelled ||
        generation !== joinGenerationRef.current ||
        sessionId !== sessionIdRef.current ||
        endingRef.current ||
        isCleaningUpRef.current
      ) {
        if (engine && !engine.roomLoginConfirmed) {
          void leaveZegoRoom(engine, joinConfig.roomId).catch(() => undefined);
        }
        return;
      }

      engineRef.current = engine;
      if (!joined) {
        // FAILED — never mark connected; stop preview cam/mic; clean Zego leftovers.
        previewCleanupRef.current?.();
        previewCleanupRef.current = null;
        if (engine) {
          void leaveZegoRoom(engine, joinConfig.roomId).catch(() => undefined);
          engineRef.current = null;
        }
        alreadyJoinedRef.current = false;

        const friendly = joinError || ZEGO_UNAVAILABLE_USER_MESSAGE;
        devLog('ZEGO_JOIN_FAILED', {
          callId,
          role,
          roomId: joinConfig.roomId,
          userId: zegoUserId,
          appId: joinConfig.appId,
          errorCode: joinErrorCode,
          // message only — never tokens
          error: joinError,
        });
        if (mountedRef.current && !endingRef.current) {
          setConnected(false);
          setRemoteConnected(false);
          setConnectionPhase('failed');
          setErrorCode(joinErrorCode ?? '200101');
          setError(friendly);
        }
        return;
      }

      alreadyJoinedRef.current = true;

      if (publishWarning && mountedRef.current) {
        toast.message(publishWarning);
      }

      previewCleanupRef.current?.();
      previewCleanupRef.current = null;

      if (engine?.localZegoStream && localRef.current) {
        engine.localZegoStream.playVideo(localRef.current);
      }

      if (mountedRef.current && !endingRef.current) {
        setConnected(true);
        setRemoteConnected((engine?.remoteStreamIds.size ?? 0) > 0);
        setConnectionPhase('connected');
        setError(null);
        setErrorCode(null);
        devLog('CONNECTED', {
          callId,
          role,
          roomId: joinConfig.roomId,
          userId: zegoUserId,
        });
      }
    })()
      .catch((err) => {
        if (endingRef.current || sessionId !== sessionIdRef.current) return;
        previewCleanupRef.current?.();
        previewCleanupRef.current = null;
        engineRef.current = null;
        alreadyJoinedRef.current = false;
        devLog('ZEGO_JOIN_UNEXPECTED', {
          callId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (mountedRef.current && !endingRef.current) {
          setConnected(false);
          setConnectionPhase('failed');
          setErrorCode('join_failed');
          setError(ZEGO_UNAVAILABLE_USER_MESSAGE);
        }
      })
      .finally(() => {
        if (generation === joinGenerationRef.current) {
          joinInProgressRef.current = false;
        }
      });

    return () => {
      cancelled = true;
      // Do NOT destroy engine here (Strict Mode / dep churn). Session invalidation
      // on real end uses cleanupOnce → teardownEngine.
    };
  }, [isVirtualHost, userId, callId, role, hostAccepted, roomId, joinRetry, displayName]);

  // Permanent unmount for this callId only (not Strict Mode soft remount of join effect).
  useEffect(() => {
    return () => {
      if (endingRef.current || isCleaningUpRef.current) {
        teardownEngine();
        return;
      }
      // Soft leave: invalidate session so in-flight joins abort; defer engine destroy
      // so Strict Mode remount can re-join without fighting a half-destroyed client.
      sessionIdRef.current += 1;
      joinInProgressRef.current = false;
      const eng = engineRef.current;
      const rid = eng?.joinedRoomId || roomId;
      engineRef.current = null;
      alreadyJoinedRef.current = false;
      window.setTimeout(() => {
        if (endingRef.current || isCleaningUpRef.current) {
          void leaveZegoRoom(eng, rid).catch(() => undefined);
          return;
        }
        // If a new session already joined, keep it.
        if (engineRef.current?.roomLoginConfirmed) return;
        void leaveZegoRoom(eng, rid).catch(() => undefined);
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on call identity change
  }, [callId]);

  useEffect(() => {
    // True tab close / navigate-away — not React Strict Mode remounts.
    const releaseMediaOnExit = () => {
      if (isCleaningUpRef.current || endingRef.current || !engineRef.current) return;
      // Only end the server call if we were actually connected/active.
      if (!callActiveRef.current) return;
      void handleEndRef.current();
    };
    window.addEventListener('pagehide', releaseMediaOnExit);
    return () => window.removeEventListener('pagehide', releaseMediaOnExit);
  }, []);

  useEffect(() => {
    if (!connected || isCleaningUpRef.current) return;
    const t = setInterval(() => {
      if (!isCleaningUpRef.current && !endingRef.current && mountedRef.current) {
        setElapsed((e) => e + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [connected]);

  useEffect(() => {
    if (!connected || isCleaningUpRef.current) return;
    const poll = setInterval(() => {
      if (!mountedRef.current || isCleaningUpRef.current || endingRef.current) return;
      const hasRemote = (engineRef.current?.remoteStreamIds.size ?? 0) > 0;
      setRemoteConnected(hasRemote);
    }, 1000);
    return () => clearInterval(poll);
  }, [connected]);

  useEffect(() => {
    if (isCleaningUpRef.current || !connected || isHost || !remoteConnected || !callActiveRef.current) {
      return;
    }

    const billingStartsAt = isFreeCall ? FREE_CALL_MAX_SECONDS : 0;
    if (elapsed <= billingStartsAt) return;

    const billableElapsed = elapsed - billingStartsAt;
    const currentMinute = Math.floor(billableElapsed / 60);
    if (currentMinute === 0 || currentMinute <= lastBilledMinuteRef.current) return;

    const minuteToBill = currentMinute;
    let cancelled = false;

    (async () => {
      try {
        const result = await callsApi.billingTick(callId);
        if (cancelled || endingRef.current) return;

        if (result.billed) {
          lastBilledMinuteRef.current = minuteToBill;
          await fetchWallet();
          if (result.lowBalance && !lowBalanceWarnedRef.current) {
            lowBalanceWarnedRef.current = true;
            setLowBalanceMode(true);
            setRechargeOpen(true);
          }
          return;
        }

        if (result.reason === 'balance_zero') {
          toast.error('Balance empty — recharge to continue calling');
          await handleEndRef.current();
          onRecharge?.();
          router.push('/wallet/purchase');
          return;
        }
      } catch (err) {
        if (cancelled || endingRef.current) return;
        logBackgroundApiFailure(`/calls/${callId}/billing-tick`, err);
        const message = err instanceof Error ? err.message : '';
        if (message.toLowerCase().includes('balance') || message.includes('balance_zero')) {
          toast.error('Balance empty — recharge to continue calling');
          await handleEndRef.current();
          onRecharge?.();
          router.push('/wallet/purchase');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    callId,
    connected,
    elapsed,
    fetchWallet,
    isFreeCall,
    isHost,
    onRecharge,
    remoteConnected,
    router,
  ]);

  useEffect(() => {
    if (isFreeCall || isHost || !serverCallActive || isCleaningUpRef.current) return;
    if (balance > 0 && balance < coinsPerMinute && !lowBalanceWarnedRef.current) {
      lowBalanceWarnedRef.current = true;
      setLowBalanceMode(true);
      setRechargeOpen(true);
    }
  }, [balance, coinsPerMinute, isFreeCall, isHost, serverCallActive]);

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      setZegoMicrophoneMuted(engineRef.current, next);
      toast.info(next ? 'Microphone muted' : 'Microphone on');
      return next;
    });
  };

  const toggleCamera = () => {
    setCameraOff((current) => {
      const next = !current;
      setZegoCameraEnabled(engineRef.current, !next);
      toast.info(next ? 'Camera off' : 'Camera on');
      return next;
    });
  };

  const pushGiftEvent = useCallback((event: GiftSentEvent) => {
    if (seenGiftIdsRef.current.has(event.id)) return;
    seenGiftIdsRef.current.add(event.id);
    setGiftEvents((prev) => [...prev, event]);
    if (new Date(event.createdAt).getTime() > new Date(lastFeedAtRef.current).getTime()) {
      lastFeedAtRef.current = event.createdAt;
    }
    setCombo((prev) => {
      if (prev?.giftId === event.giftId) {
        return { giftId: event.giftId, icon: event.gift.icon, count: prev.count + event.quantity };
      }
      return { giftId: event.giftId, icon: event.gift.icon, count: event.quantity };
    });
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(null), 4000);
  }, []);

  useEffect(() => {
    if (!connected || isCleaningUpRef.current || endingRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const consumeGift = (gift: GiftSentEvent) => {
      if (gift.sender.id === userId) return;
      pushGiftEvent(gift);
      if (role === 'callee') {
        toast.success(`${gift.sender.displayName} sent ${gift.gift.name}${gift.quantity > 1 ? ` ×${gift.quantity}` : ''}!`, {
          description: `+${gift.hostEarningCoins} coins earned`,
        });
      }
    };

    const onCallGift = (event: Event) => {
      const detail = (event as CustomEvent<{ callId: string; gift: GiftSentEvent }>).detail;
      if (detail?.callId === callId) consumeGift(detail.gift);
    };

    const poll = async () => {
      try {
        const feed = await giftsApi.callFeed(callId, lastFeedAtRef.current);
        for (const gift of feed.gifts) consumeGift(gift);
      } catch (err) {
        logBackgroundApiFailure(`/calls/${callId}/gifts/feed`, err);
      } finally {
        if (!cancelled && !isCleaningUpRef.current && !endingRef.current) {
          timer = setTimeout(poll, 30_000 + Math.random() * 15_000);
        }
      }
    };

    window.addEventListener('platform:call-gift', onCallGift);
    timer = setTimeout(poll, Math.random() * 3_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('platform:call-gift', onCallGift);
    };
  }, [callId, connected, userId, role, pushGiftEvent]);

  const handleSendGift = async (gift: GiftCatalogItem, quantity: number) => {
    if (!giftsEnabled || giftSending || isCleaningUpRef.current || endingRef.current) return;
    const total = gift.coinPrice * quantity;
    if (balance < total) {
      setRechargeOpen(true);
      return;
    }
    setGiftSending(true);
    const idempotencyKey = `gift:${callId}:${gift.id}:${Date.now()}`;
    try {
      const result = await giftsApi.send(callId, gift.id, quantity, idempotencyKey);
      if (!mountedRef.current || endingRef.current) return;
      useWalletStore.getState().setWallet({
        balanceCoins: result.balanceCoins,
        balanceUnits: String(Math.round(result.balanceCoins * 100)),
        lockedUnits: wallet?.lockedUnits ?? '0',
        freeCallsUsed: wallet?.freeCallsUsed ?? 0,
        freeCallsRemaining: wallet?.freeCallsRemaining ?? 0,
      });
      pushGiftEvent(result.gift);
      const reaction = (result as { giftReaction?: { message?: string; animation?: string } })
        .giftReaction;
      if (reaction && isVirtualHost) {
        setGiftReaction({
          ...reaction,
          category: gift.category,
          animationTier: gift.animationTier,
        });
      }
      if (isVirtualHost) void conversation.sendEvent('gift_received', gift.name);
      toast.success(`${gift.icon} ${gift.name} sent!`, {
        description: reaction?.message ?? `${total} coins · ${result.balanceCoins} remaining`,
      });
    } catch (err) {
      if (!mountedRef.current || endingRef.current) return;
      const msg = err instanceof Error ? err.message : 'Could not send gift';
      if (msg.toLowerCase().includes('insufficient')) setRechargeOpen(true);
      else toast.error(msg);
    } finally {
      if (mountedRef.current) setGiftSending(false);
    }
  };

  // AI host: overlay path. Real host: only CONNECTED after successful Zego join.
  const callInProgress = isVirtualHost
    ? serverCallActive || connected
    : connected && connectionPhase === 'connected';

  if (error && !callInProgress) {
    const hostMissed = error.toLowerCase().includes('did not answer');
    const unavailable =
      !hostMissed &&
      (error.includes('temporarily unavailable') ||
        error.includes('200101') ||
        error.includes('auth') ||
        connectionPhase === 'failed');

    return (
      <ErrorState
        title={
          hostMissed
            ? 'Host did not answer'
            : unavailable
              ? 'Video calling unavailable'
              : 'Unable to connect'
        }
        message={
          hostMissed
            ? 'No host accepted in time. Try again or choose another host.'
            : unavailable
              ? ZEGO_UNAVAILABLE_USER_MESSAGE
              : error
        }
        code={errorCode ?? undefined}
        onRetry={() => {
          if (hostMissed) {
            void (async () => {
              if (!cleanupOnce('local')) return;
              void callsApi.end(callId).catch(() => undefined);
              router.replace('/video-call');
            })();
            return;
          }
          // Clean failed session completely, then one new join (no engine pile-up).
          const eng = engineRef.current;
          engineRef.current = null;
          alreadyJoinedRef.current = false;
          joinInProgressRef.current = false;
          sessionIdRef.current += 1;
          if (eng) void leaveZegoRoom(eng, eng.joinedRoomId || roomId).catch(() => undefined);
          previewCleanupRef.current?.();
          previewCleanupRef.current = null;
          setConnected(false);
          setRemoteConnected(false);
          setConnectionPhase('idle');
          setError(null);
          setErrorCode(null);
          setJoinRetry((n) => n + 1);
        }}
        retryLabel={hostMissed ? 'Find another host' : 'Retry'}
        onSecondary={() => {
          if (!cleanupOnce('local')) {
            router.replace('/home');
            return;
          }
          exitCall();
          void callsApi.end(callId).catch(() => undefined);
        }}
        secondaryLabel="Go home"
        className="min-h-dvh bg-[#0F0F12]"
      />
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#0F0F12]">
      <GiftAnimationLayer events={giftEvents} />
      {combo && <GiftComboBadge icon={combo.icon} giftId={combo.giftId} count={combo.count} />}
      <GiftStoreSheet
        open={giftStoreOpen}
        onClose={() => setGiftStoreOpen(false)}
        balance={balance}
        disabled={!giftsEnabled}
        sending={giftSending}
        onSend={handleSendGift}
        onInsufficientBalance={() => setRechargeOpen(true)}
      />
      <RechargeSheet
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        balance={balance}
        coinsPerMinute={coinsPerMinute}
        lowBalance={lowBalanceMode}
        onEndCall={() => void handleEnd()}
      />
      <div ref={remoteRef} className="absolute inset-0 z-0 bg-[#0F0F12]">
        {isVirtualHost && virtualHost && (
          <VirtualHostOverlay
            virtualHost={virtualHost}
            connected={connected && !waitingForHost}
            giftReaction={giftReaction}
            subtitle={conversation.currentSubtitle}
            speaking={conversation.speaking}
            thinking={conversation.thinking || avatarCallEvent === 'typing'}
            emotion={conversation.emotion}
            callEvent={avatarCallEvent}
            lockedVideoUrl={lockedVideoUrl}
          />
        )}
        {(!connected || waitingForHost) && !isVirtualHost && (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0F0F12]">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-[#FF2E74]/20" />
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF2E74]/30 border-t-[#FF2E74]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {waitingForHost ? 'Waiting for host' : 'Connecting'}
              </p>
              <p className="mt-1 text-xs text-[#A7A7B3]">
                {waitingForHost ? 'They will join shortly…' : 'Setting up video…'}
              </p>
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF2E74]"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        ref={localRef}
        className="absolute right-4 top-20 z-10 h-32 w-24 overflow-hidden rounded-[20px] border border-white/12 bg-[#17171C] shadow-[0_8px_32px_rgba(0,0,0,0.5)] sm:h-40 sm:w-28"
      >
        {cameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#17171C] text-xs text-[#A7A7B3]">
            Camera off
          </div>
        )}
      </div>

      <div className="relative z-20 flex items-start justify-between gap-3 p-4 pt-5">
        <div className="premium-glass max-w-[55%] rounded-[20px] px-4 py-3">
          <p className="font-semibold text-white">{partnerName}</p>
          {showOnline && (
            <span
              className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-400"
              aria-label="Online"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Online
            </span>
          )}
          <p className="mt-1 font-mono text-sm tabular-nums text-[#FFB347]">{formatDuration(elapsed)}</p>
        </div>
        {!isHost && (
          <div className="premium-glass shrink-0 rounded-full px-4 py-2.5 text-sm font-medium text-white">
            <span className="text-[#FFB347]">●</span> {balance} coins
          </div>
        )}
        {reportedUserId && (
          <ReportUserDialog
            reportedUserId={reportedUserId}
            reportedUserName={reportedUserName}
            callId={callId}
            className="premium-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#A7A7B3] transition-colors hover:text-white"
            trigger={<Flag className="h-4 w-4" />}
          />
        )}
      </div>

      <div className="relative z-20 mt-auto flex flex-col items-center gap-3 px-4 pb-10 pt-4">
        <div className="flex items-end gap-3">
          {!isHost && connected && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-full"
              disabled={!giftsEnabled || giftSending}
              aria-label="Send gift"
              onClick={() => setGiftStoreOpen(true)}
            >
              <span className="text-lg">🎁</span>
            </Button>
          )}
          <CallControls
            muted={muted}
            cameraOff={cameraOff}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onEndCall={handleEnd}
          />
        </div>
      </div>
    </div>
  );
}
