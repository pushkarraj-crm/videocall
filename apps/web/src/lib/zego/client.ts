'use client';

import { devLog } from '@/lib/dev-log';

export interface ZegoCallConfig {
  appId: number;
  token: string;
  roomId: string;
  userId: string;
  userName: string;
  role?: 'caller' | 'callee';
  localVideo?: HTMLElement | null;
  remoteVideo?: HTMLElement | null;
  onRemoteHangup?: () => void;
  onRemoteStream?: (streamId: string) => void;
  onLocalStream?: () => void;
  onJoined?: (role: 'caller' | 'callee') => void;
}

type ZegoLocalStreamHandle = {
  active?: boolean;
  playVideo: (view: HTMLElement) => void;
  getTracks?: () => MediaStreamTrack[];
  getVideoTracks?: () => MediaStreamTrack[];
  getAudioTracks?: () => MediaStreamTrack[];
  stopVideo?: () => void;
  stopCaptureVideo?: () => Promise<boolean>;
  stopCaptureAudio?: () => Promise<boolean>;
  startCaptureCameraAndMicrophone?: () => Promise<{ errorCode: number }>;
  stream?: MediaStream | null;
  videoCaptureStream?: MediaStream | null;
  audioCaptureStream?: MediaStream | null;
};

type ZegoExpressEngineInstance = {
  loginRoom: (
    roomId: string,
    token: string,
    user: { userID: string; userName: string },
    config?: { userUpdate?: boolean },
  ) => Promise<boolean>;
  createZegoStream: (options?: {
    autoCapture?: boolean;
    camera?: { video?: boolean; audio?: boolean };
  }) => Promise<ZegoLocalStreamHandle>;
  mutePublishStreamVideo: (localStream: unknown, mute: boolean) => boolean;
  mutePublishStreamAudio: (localStream: unknown, mute: boolean) => boolean;
  startPublishingStream: (streamId: string, localStream: unknown) => boolean;
  startPlayingStream: (
    streamId: string,
    playOption?: { container?: HTMLElement },
  ) => Promise<MediaStream>;
  stopPlayingStream: (streamId: string) => void;
  stopPublishingStream: (streamId: string) => boolean;
  destroyStream: (localStream: unknown) => void;
  logoutRoom: (roomId: string) => void;
  destroyEngine: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => boolean;
  off?: (event: string, cb: (...args: unknown[]) => void) => boolean;
};

export type ZegoEngine = ZegoExpressEngineInstance & {
  localStreamId: string;
  localZegoStream: ZegoLocalStreamHandle | null;
  remoteStreamIds: Set<string>;
  pendingRemoteStreamIds: Set<string>;
  roomLoginConfirmed: boolean;
  joinedRoomId: string;
  destroyed: boolean;
  roomStreamUpdateHandler?: (...args: unknown[]) => void;
  hangupHandlers?: Array<{ event: string; handler: (...args: unknown[]) => void }>;
};

let zegoErrorShieldDepth = 0;
let zegoWindowErrorHandler: ((event: ErrorEvent) => void) | null = null;
let zegoRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

/** Serializes engine teardown so the next call always starts from a clean SDK state. */
let globalEngine: ZegoEngine | null = null;
let teardownPromise: Promise<void> | null = null;
/** Prevent concurrent joinZegoRoom calls (React Strict Mode / double effect). */
let joinInFlight: Promise<JoinZegoResult> | null = null;
let joinInFlightKey: string | null = null;

export type JoinZegoResult = {
  engine: ZegoEngine | null;
  joined: boolean;
  error: string | null;
  /** Machine-readable code for diagnostics (e.g. 200101) — never secrets. */
  errorCode?: string | null;
  publishWarning?: string | null;
};

function zegoErrorText(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err.toLowerCase();
  if (err instanceof Error) return err.message.toLowerCase();
  if (typeof err === 'object') {
    const record = err as Record<string, unknown>;
    return [record.errorCode, record.extendedData, record.message, record.action, record.content]
      .filter((part) => part !== undefined && part !== null && part !== '')
      .map(String)
      .join(' ')
      .toLowerCase();
  }
  return String(err).toLowerCase();
}

function isNotLoginPublishError(err: unknown): boolean {
  const text = zegoErrorText(err);
  return text.includes('not login') || text.includes('zc.sps.0');
}

function isTransientZegoPublishError(err: unknown): boolean {
  const text = zegoErrorText(err);
  if (!text) return false;
  if (isNotLoginPublishError(err)) return false;
  return (
    text.includes('1000002') ||
    text.includes('not capturing') ||
    text.includes('publish request failed')
  );
}

function attachZegoErrorShield() {
  if (typeof window === 'undefined') return;
  zegoErrorShieldDepth += 1;
  if (zegoErrorShieldDepth > 1) return;

  zegoWindowErrorHandler = (event: ErrorEvent) => {
    const text = `${event.message ?? ''} ${event.error ?? ''}`;
    if (isTransientZegoPublishError(text)) {
      event.preventDefault();
      devLog('[Zego] transient window error (handled)', event.message);
      return;
    }
    // Keep Next.js error overlay clean for known Zego auth/network noise (20021 / 200101).
    // Failures are still surfaced via join result + in-app ErrorState.
    if (
      isZegoAuthFailure(text) ||
      /20021|200101|1002099|zn\.nab\.gac|zm\.fac|zm\.lrh|loginroomreq|auth failure/i.test(text)
    ) {
      event.preventDefault();
      devLog('[Zego] room auth/network window error (handled)', {
        message: event.message,
        code: extractZegoErrorCode(event.error ?? event.message),
      });
    }
  };

  zegoRejectionHandler = (event: PromiseRejectionEvent) => {
    if (isTransientZegoPublishError(event.reason)) {
      event.preventDefault();
      devLog('[Zego] transient rejection (handled)');
      return;
    }
    if (
      isZegoAuthFailure(event.reason) ||
      /20021|200101|1002099|auth failure/i.test(zegoErrorText(event.reason))
    ) {
      event.preventDefault();
      devLog('[Zego] room auth rejection (handled)', {
        code: extractZegoErrorCode(event.reason),
      });
    }
  };

  window.addEventListener('error', zegoWindowErrorHandler);
  window.addEventListener('unhandledrejection', zegoRejectionHandler);
}

function detachZegoErrorShield() {
  if (typeof window === 'undefined') return;
  zegoErrorShieldDepth = Math.max(0, zegoErrorShieldDepth - 1);
  if (zegoErrorShieldDepth > 0) return;

  if (zegoWindowErrorHandler) {
    window.removeEventListener('error', zegoWindowErrorHandler);
    zegoWindowErrorHandler = null;
  }
  if (zegoRejectionHandler) {
    window.removeEventListener('unhandledrejection', zegoRejectionHandler);
    zegoRejectionHandler = null;
  }
}

/**
 * Zego Web access point for Express Engine constructor.
 *
 * Legacy `webliveroom-hk.zego.im` is NXDOMAIN. Express 3.x uses accesshub for
 * config/dispatch. Prefer NEXT_PUBLIC_ZEGO_SERVER_URL from ZEGOCLOUD console.
 * Pass a single string (arrays can confuse some SDK builds).
 */
function getZegoServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ZEGO_SERVER_URL?.trim();
  if (configured) {
    // Reject known-dead hosts so we never silently use NXDOMAIN defaults.
    if (/webliveroom-hk\.zego\.im|webliveroom-api\.zego\.im/i.test(configured)) {
      console.warn(
        '[Zego] NEXT_PUBLIC_ZEGO_SERVER_URL points at a dead host; using accesshub-wss.zego.im',
      );
      return 'wss://accesshub-wss.zego.im/ws';
    }
    return configured;
  }
  return 'wss://accesshub-wss.zego.im/ws';
}

function getZegoServerLogHost(): string {
  return getZegoServerUrl().replace(/^wss?:\/\//, '').split('/')[0] ?? 'unknown';
}

/**
 * Zego userName: only characters allowed by Express Web docs.
 * Empty / invalid falls back to userId.
 */
function toZegoUserName(userName: string | undefined, userId: string): string {
  const cleaned = (userName ?? '')
    .replace(/[^0-9a-zA-Z~!@#$%^&*()_+\-=`;,./<>?\[\]{}|\\ ]/g, '')
    .trim()
    .slice(0, 64);
  if (cleaned) return cleaned;
  return userId.replace(/[^0-9a-zA-Z_\-]/g, '').slice(0, 64) || 'user';
}

function isZegoAuthFailure(err: unknown): boolean {
  const text = zegoErrorText(err);
  return (
    text.includes('200101') ||
    text.includes('20021') ||
    text.includes('1002033') ||
    text.includes('1002075') ||
    text.includes('1002076') ||
    text.includes('1002077') ||
    text.includes('1002078') ||
    text.includes('1002079') ||
    text.includes('1002099') ||
    text.includes('auth failure') ||
    text.includes('authentication failed') ||
    text.includes('auth/login failed') ||
    text.includes('token expire') ||
    text.includes('token format') ||
    text.includes('token appid') ||
    text.includes('token user')
  );
}

/** Stable product copy when Zego cloud rejects login (e.g. expired trial / 200101). */
export const ZEGO_UNAVAILABLE_USER_MESSAGE =
  'Video calling is temporarily unavailable. Please try again later.';

export function extractZegoErrorCode(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === 'object') {
    const record = err as Record<string, unknown>;
    if (record.errorCode !== undefined && record.errorCode !== null) {
      return String(record.errorCode);
    }
    if (record.code !== undefined && record.code !== null) {
      return String(record.code);
    }
  }
  const text = zegoErrorText(err);
  const match = text.match(/\b(200101|20021|1002099|1002033|100207[5-9])\b/);
  return match?.[1];
}

/**
 * User-facing join failure message.
 * Production: never expose secrets, stack traces, or raw Zego payloads.
 * Development: append safe codes only (no token/secret).
 */
function formatJoinFailure(
  err: unknown,
  ctx?: { appId?: number; roomId?: string; userId?: string },
): string {
  if (isZegoAuthFailure(err) || /1002099|200101|20021|auth/i.test(zegoErrorText(err))) {
    if (process.env.NODE_ENV === 'development') {
      const code = extractZegoErrorCode(err) ?? 'auth';
      return (
        `${ZEGO_UNAVAILABLE_USER_MESSAGE} ` +
        `[dev code=${code} appId=${ctx?.appId ?? '?'} roomId=${ctx?.roomId ?? '?'} ` +
        `userId=${ctx?.userId ?? '?'} server=${getZegoServerLogHost()}]`
      );
    }
    return ZEGO_UNAVAILABLE_USER_MESSAGE;
  }
  return formatZegoError(err);
}

function stopMediaStreamTracks(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    if (track.readyState !== 'ended') {
      track.stop();
    }
  });
}

function stopLocalStreamTracks(localStream: ZegoLocalStreamHandle | null) {
  if (!localStream) return;

  stopMediaStreamTracks(localStream.stream);
  stopMediaStreamTracks(localStream.videoCaptureStream);
  stopMediaStreamTracks(localStream.audioCaptureStream);

  localStream.getTracks?.().forEach((track) => {
    if (track.readyState !== 'ended') track.stop();
  });
  localStream.getVideoTracks?.().forEach((track) => {
    if (track.readyState !== 'ended') track.stop();
  });
  localStream.getAudioTracks?.().forEach((track) => {
    if (track.readyState !== 'ended') track.stop();
  });
}

function safeSdkCall(action: () => void) {
  try {
    action();
  } catch {
    /* SDK throws when stream/room already torn down */
  }
}

function formatZegoError(err: unknown): string {
  if (err && typeof err === 'object') {
    const record = err as { errorCode?: unknown; extendedData?: unknown; message?: unknown };
    if (record.errorCode !== undefined) {
      const detail =
        typeof record.extendedData === 'string' && record.extendedData
          ? `: ${record.extendedData}`
          : '';
      return `Zego error ${String(record.errorCode)}${detail}`;
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
  }
  return err instanceof Error ? err.message : 'Zego room join failed';
}

/**
 * Resolves when roomStateUpdate reports CONNECTED.
 * Does NOT treat intermediate DISCONNECTED during LOGINING as fatal unless errorCode is set.
 * Permanent auth/login failures reject with a clear error (do not mark business call ENDED here).
 */
function waitForZegoRoomConnected(
  engine: ZegoExpressEngineInstance,
  roomId: string,
  timeoutMs = 25_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      engine.off?.('roomStateUpdate', onRoomStateUpdate);
    };

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };

    const onRoomStateUpdate = (
      updatedRoomId: unknown,
      state: unknown,
      errorCode: unknown,
      extendedData?: unknown,
    ) => {
      if (updatedRoomId !== roomId) return;

      const code = typeof errorCode === 'number' ? errorCode : 0;
      devLog('ZEGO_ROOM_STATE', {
        roomId: updatedRoomId,
        state,
        errorCode: code,
        extendedData: typeof extendedData === 'string' ? extendedData.slice(0, 120) : undefined,
      });

      // Only CONNECTED means media path is ready. Do not treat LOGINED as done —
      // attaching hangup listeners too early caused false disconnects.
      if (state === 'CONNECTED') {
        devLog('ZEGO_ROOM_CONNECTED', { roomId: updatedRoomId, state });
        finish(resolve);
        return;
      }

      // Permanent failures only — ignore clean logout (code 0) and reconnection fluff.
      if (state === 'DISCONNECTED' && code !== 0) {
        const authish =
          code === 1002033 ||
          code === 1002076 ||
          code === 1002077 ||
          code === 1002078 ||
          code === 1002099 ||
          code === 200101;
        finish(() =>
          reject(
            new Error(
              authish
                ? `Zego room auth/login failed (${code})`
                : `Zego room disconnected (${code})`,
            ),
          ),
        );
      }
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Zego room connection timeout')));
    }, timeoutMs);

    engine.on('roomStateUpdate', onRoomStateUpdate);
  });
}

function waitForZegoRoomDisconnected(
  engine: ZegoExpressEngineInstance,
  roomId: string,
  timeoutMs = 5_000,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      engine.off?.('roomStateUpdate', onRoomStateUpdate);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const onRoomStateUpdate = (updatedRoomId: unknown, state: unknown) => {
      if (updatedRoomId !== roomId || state !== 'DISCONNECTED') return;
      devLog('[Zego] room logout confirmed', { roomId: updatedRoomId });
      finish();
    };

    const timer = setTimeout(finish, timeoutMs);
    engine.on('roomStateUpdate', onRoomStateUpdate);
  });
}

async function ensureLocalCaptureReady(localStream: ZegoLocalStreamHandle) {
  if (localStream.active && (localStream.getTracks?.().length ?? 0) > 0) {
    return;
  }

  if (localStream.startCaptureCameraAndMicrophone) {
    const result = await localStream.startCaptureCameraAndMicrophone();
    if (result.errorCode !== 0) {
      throw new Error(`Zego capture failed (${result.errorCode})`);
    }
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (localStream.active && (localStream.getTracks?.().length ?? 0) > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Zego local stream is not capturing');
}

function toZegoStreamId(userId: string): string {
  const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `stream_${sanitized || 'local'}`;
}

async function settleZegoRoomSession(delayMs = 600): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function publishLocalStream(
  engine: ZegoEngine,
  streamId: string,
  localStream: ZegoLocalStreamHandle,
): boolean {
  if (!engine.roomLoginConfirmed) {
    throw new Error('Cannot publish: room login not confirmed');
  }

  devLog('PUBLISH_START', { streamId, roomId: engine.joinedRoomId });

  try {
    const published = engine.startPublishingStream(streamId, localStream);
    if (published) {
      devLog('PUBLISH_SUCCESS', { streamId, roomId: engine.joinedRoomId });
      return true;
    }
    console.warn('PUBLISH_FAILED', {
      streamId,
      roomId: engine.joinedRoomId,
      reason: 'startPublishingStream returned false',
    });
    return false;
  } catch (err) {
    console.error('PUBLISH_FAILED', { streamId, roomId: engine.joinedRoomId, error: err });
    throw err;
  }
}

async function publishLocalStreamWithRetry(
  engine: ZegoEngine,
  streamId: string,
  localStream: ZegoLocalStreamHandle,
  maxAttempts = 6,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (engine.destroyed || !engine.roomLoginConfirmed) {
      throw new Error('Cannot publish: room session ended');
    }

    try {
      const published = publishLocalStream(engine, streamId, localStream);
      if (published) return true;
    } catch (err) {
      if (!isNotLoginPublishError(err) || attempt === maxAttempts) {
        throw err;
      }
      console.warn('[Zego] publish not ready, retrying', {
        attempt,
        roomId: engine.joinedRoomId,
      });
    }

    if (attempt < maxAttempts) {
      await settleZegoRoomSession(400);
    }
  }

  return false;
}

async function playRemoteStreams(
  engine: ZegoEngine,
  config: ZegoCallConfig,
  streamIds: Iterable<string>,
) {
  if (!config.remoteVideo || engine.destroyed || !engine.roomLoginConfirmed) return;

  const localStreamId = engine.localStreamId;

  for (const streamId of streamIds) {
    if (!streamId || streamId === localStreamId || engine.remoteStreamIds.has(streamId)) continue;

    try {
      await engine.startPlayingStream(streamId, { container: config.remoteVideo });
      if (engine.destroyed) {
        safeStopPlaying(engine, streamId);
        return;
      }
      engine.remoteStreamIds.add(streamId);
      engine.pendingRemoteStreamIds.delete(streamId);
      devLog('REMOTE_STREAM_RECEIVED', { streamId, roomId: config.roomId });
      config.onRemoteStream?.(streamId);
    } catch (err) {
      console.warn('[Zego] failed to play remote stream:', streamId, err);
    }
  }
}

function attachHangupListeners(engine: ZegoEngine, config: ZegoCallConfig) {
  if (!config.onRemoteHangup) return;

  const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  const notifyHangup = (reason: string) => {
    if (engine.destroyed || !engine.roomLoginConfirmed) return;
    devLog(`[Zego] remote hangup signal: ${reason}`);
    config.onRemoteHangup?.();
  };

  const onRoomUserUpdate = (updatedRoomId: unknown, updateType: unknown, userList: unknown) => {
    if (updatedRoomId !== config.roomId || engine.destroyed || !engine.roomLoginConfirmed) return;
    if (updateType !== 'DELETE') return;
    const users = (userList as Array<{ userID?: string }> | undefined) ?? [];
    const remoteLeft = users.some((user) => user.userID && user.userID !== config.userId);
    if (remoteLeft) notifyHangup('participant left');
  };

  const onRoomStateUpdate = (
    updatedRoomId: unknown,
    state: unknown,
    errorCode?: unknown,
  ) => {
    if (updatedRoomId !== config.roomId || engine.destroyed || !engine.roomLoginConfirmed) return;
    // Only permanent disconnect with non-zero code after a successful login.
    // Reconnecting/LOGINING noise must not end the business call.
    if (state === 'DISCONNECTED' && typeof errorCode === 'number' && errorCode !== 0) {
      notifyHangup(`room disconnected (${errorCode})`);
    }
  };

  engine.on('roomUserUpdate', onRoomUserUpdate);
  engine.on('roomStateUpdate', onRoomStateUpdate);
  handlers.push(
    { event: 'roomUserUpdate', handler: onRoomUserUpdate },
    { event: 'roomStateUpdate', handler: onRoomStateUpdate },
  );

  engine.hangupHandlers = handlers;
}

function safeStopPublishing(engine: ZegoEngine) {
  if (!engine.localStreamId) return;
  safeSdkCall(() => {
    engine.stopPublishingStream(engine.localStreamId);
  });
}

function safeStopPlaying(engine: ZegoEngine, streamId: string) {
  if (!streamId || !engine.remoteStreamIds.has(streamId)) return;
  safeSdkCall(() => {
    engine.stopPlayingStream(streamId);
  });
  engine.remoteStreamIds.delete(streamId);
}

async function createFreshZegoEngine(appId: number): Promise<ZegoEngine | null> {
  if (typeof window === 'undefined' || !appId) return null;

  const { ZegoExpressEngine } = await import('zego-express-engine-webrtc');
  const server = getZegoServerUrl();
  const engine = new ZegoExpressEngine(appId, server) as ZegoExpressEngineInstance;

  devLog('ZEGO_ENGINE_CREATED', {
    appId,
    serverHost: getZegoServerLogHost(),
  });

  return Object.assign(engine, {
    localStreamId: '',
    localZegoStream: null as ZegoLocalStreamHandle | null,
    remoteStreamIds: new Set<string>(),
    pendingRemoteStreamIds: new Set<string>(),
    roomLoginConfirmed: false,
    joinedRoomId: '',
    destroyed: false,
  });
}

/** Ensures any prior engine is fully torn down before creating a new one. */
export async function getZegoEngine(appId: number): Promise<ZegoEngine | null> {
  if (teardownPromise) {
    await teardownPromise;
  }

  if (globalEngine && !globalEngine.destroyed) {
    const roomId = globalEngine.joinedRoomId;
    devLog('[Zego] awaiting stale engine teardown', { roomId });
    await leaveZegoRoom(globalEngine, roomId);
  }

  const engine = await createFreshZegoEngine(appId);
  if (engine) {
    globalEngine = engine;
  }
  return engine;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function joinZegoRoomOnce(config: ZegoCallConfig): Promise<JoinZegoResult> {
  const appId = Number(config.appId);
  if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
    return {
      engine: null,
      joined: false,
      error: 'Invalid Zego App ID. Check NEXT_PUBLIC_ZEGO_APP_ID and API ZEGO_APP_ID.',
    };
  }

  if (!config.userId || typeof config.userId !== 'string') {
    return { engine: null, joined: false, error: 'Missing Zego user ID for room login' };
  }

  if (!config.roomId || typeof config.roomId !== 'string') {
    return { engine: null, joined: false, error: 'Missing Zego room ID for room login' };
  }

  if (!config.token || typeof config.token !== 'string' || !config.token.startsWith('04')) {
    return {
      engine: null,
      joined: false,
      error:
        'Invalid Zego token. Ensure ZEGO_APP_ID and ZEGO_SERVER_SECRET are configured on the API.',
    };
  }

  const publicAppId = process.env.NEXT_PUBLIC_ZEGO_APP_ID?.trim();
  if (publicAppId && Number(publicAppId) !== appId) {
    console.error('ZEGO_APP_ID_MISMATCH', {
      tokenAppId: appId,
      publicAppId: Number(publicAppId),
    });
    return {
      engine: null,
      joined: false,
      error:
        'Zego App ID mismatch between client and token. NEXT_PUBLIC_ZEGO_APP_ID must match API ZEGO_APP_ID.',
    };
  }

  const engine = await getZegoEngine(appId);
  if (!engine) {
    return { engine: null, joined: false, error: 'Zego engine unavailable' };
  }

  attachZegoErrorShield();

  const localStreamId = toZegoStreamId(config.userId);
  const userName = toZegoUserName(config.userName, config.userId);
  engine.localStreamId = localStreamId;
  engine.joinedRoomId = config.roomId;

  devLog('ZEGO_JOIN_CONFIG', {
    appId,
    roomId: config.roomId,
    userId: config.userId,
    role: config.role,
    tokenPresent: true,
    tokenLen: config.token.length,
    tokenPrefix: config.token.slice(0, 2),
    serverHost: getZegoServerLogHost(),
  });

  try {
    const roomStreamUpdateHandler = async (...args: unknown[]) => {
      if (engine.destroyed || !engine.roomLoginConfirmed) return;

      const updatedRoomId = args[0] as string;
      const updateType = args[1] as string;
      const streamList = args[2] as Array<{ streamID: string }>;

      if (updatedRoomId !== config.roomId) return;

      if (updateType === 'DELETE') {
        for (const stream of streamList) {
          if (stream.streamID !== localStreamId) {
            safeStopPlaying(engine, stream.streamID);
          }
        }
        if (
          engine.roomLoginConfirmed &&
          engine.remoteStreamIds.size === 0 &&
          streamList.some((stream) => stream.streamID !== localStreamId)
        ) {
          config.onRemoteHangup?.();
        }
        return;
      }

      if (updateType !== 'ADD') return;

      const remoteIds = streamList
        .map((stream) => stream.streamID)
        .filter((streamId) => streamId && streamId !== localStreamId);

      for (const streamId of remoteIds) {
        engine.pendingRemoteStreamIds.add(streamId);
      }

      await playRemoteStreams(engine, config, remoteIds);
    };

    engine.roomStreamUpdateHandler = roomStreamUpdateHandler;
    engine.on('roomStreamUpdate', roomStreamUpdateHandler);

    // Login BEFORE media — auth must succeed first.
    devLog('ZEGO_LOGIN_START', {
      roomId: config.roomId,
      userId: config.userId,
      appId,
      role: config.role,
    });

    const roomConnected = waitForZegoRoomConnected(engine, config.roomId);

    let joined: boolean;
    try {
      joined = await withTimeout(
        engine.loginRoom(
          config.roomId,
          config.token,
          { userID: config.userId, userName },
          { userUpdate: true },
        ),
        25_000,
        'Zego loginRoom',
      );
    } catch (err) {
      // Intentional teardown / abort must not spam Next.js error overlay.
      if (engine.destroyed) {
        return { engine: null, joined: false, error: null, errorCode: null };
      }
      const code = extractZegoErrorCode(err) ?? 'login_throw';
      devLog('ZEGO_LOGIN_FAILED', {
        roomId: config.roomId,
        userId: config.userId,
        appId,
        serverHost: getZegoServerLogHost(),
        errorCode: code,
        error: err instanceof Error ? err.message : String(err),
      });
      await leaveZegoRoom(engine, config.roomId);
      return {
        engine: null,
        joined: false,
        error: formatJoinFailure(err, {
          appId,
          roomId: config.roomId,
          userId: config.userId,
        }),
        errorCode: code,
      };
    }

    if (!joined) {
      if (engine.destroyed) {
        return { engine: null, joined: false, error: null, errorCode: null };
      }
      devLog('ZEGO_LOGIN_FAILED', {
        roomId: config.roomId,
        userId: config.userId,
        appId,
        reason: 'loginRoom returned false',
        errorCode: '200101',
      });
      await leaveZegoRoom(engine, config.roomId);
      return {
        engine: null,
        joined: false,
        error: formatJoinFailure(
          { errorCode: 200101, message: 'auth failure' },
          { appId, roomId: config.roomId, userId: config.userId },
        ),
        errorCode: '200101',
      };
    }

    try {
      await roomConnected;
    } catch (err) {
      if (engine.destroyed) {
        return { engine: null, joined: false, error: null, errorCode: null };
      }
      const code = extractZegoErrorCode(err) ?? '1002099';
      devLog('ZEGO_LOGIN_FAILED', {
        roomId: config.roomId,
        userId: config.userId,
        appId,
        serverHost: getZegoServerLogHost(),
        errorCode: code,
        error: err instanceof Error ? err.message : String(err),
      });
      await leaveZegoRoom(engine, config.roomId);
      return {
        engine: null,
        joined: false,
        error: formatJoinFailure(err, {
          appId,
          roomId: config.roomId,
          userId: config.userId,
        }),
        errorCode: code,
      };
    }

    engine.roomLoginConfirmed = true;
    devLog('ZEGO_LOGIN_SUCCESS', {
      roomId: config.roomId,
      userId: config.userId,
      appId,
      role: config.role,
    });
    // Hangup listeners ONLY after confirmed login — never during auth failure.
    attachHangupListeners(engine, config);

    // Create + publish local A/V only after room auth is confirmed.
    const localStream = await withTimeout(
      engine.createZegoStream({
        autoCapture: true,
        camera: { video: true, audio: true },
      }),
      20_000,
      'Zego createZegoStream',
    );

    await ensureLocalCaptureReady(localStream);

    if (config.localVideo) {
      localStream.playVideo(config.localVideo);
    }

    engine.localZegoStream = localStream;
    devLog('LOCAL_STREAM_CREATED', { streamId: localStreamId, roomId: config.roomId });
    config.onLocalStream?.();

    await settleZegoRoomSession();

    if (config.role === 'caller') {
      devLog('USER_JOINED', { userId: config.userId, roomId: config.roomId });
    } else if (config.role === 'callee') {
      devLog('HOST_JOINED', { userId: config.userId, roomId: config.roomId });
    }
    config.onJoined?.(config.role ?? 'caller');

    const publishOk = await publishLocalStreamWithRetry(engine, localStreamId, localStream);
    await playRemoteStreams(engine, config, [...engine.pendingRemoteStreamIds]);

    return {
      engine,
      joined: true,
      error: null,
      publishWarning: publishOk ? null : 'Video publish failed',
    };
  } catch (err) {
    detachZegoErrorShield();
    // Full cleanup on any uncaught path — never leave listeners/media hanging.
    await leaveZegoRoom(engine, config.roomId);
    return {
      engine: null,
      joined: false,
      error: formatJoinFailure(err, {
        appId,
        roomId: config.roomId,
        userId: config.userId,
      }),
      errorCode: extractZegoErrorCode(err) ?? 'join_failed',
    };
  }
}

/**
 * Join a Zego room with single-flight protection.
 * Concurrent calls for the same room+user coalesce; different keys wait on teardown.
 */
export async function joinZegoRoom(config: ZegoCallConfig): Promise<JoinZegoResult> {
  const key = `${config.appId}|${config.roomId}|${config.userId}`;

  if (joinInFlight && joinInFlightKey === key) {
    devLog('ZEGO_JOIN_COALESCED', { roomId: config.roomId, userId: config.userId });
    return joinInFlight;
  }

  // If another join is in flight for a different key, wait for it to finish first.
  if (joinInFlight) {
    try {
      await joinInFlight;
    } catch {
      /* previous join failed — continue */
    }
  }

  joinInFlightKey = key;
  joinInFlight = joinZegoRoomOnce(config).finally(() => {
    if (joinInFlightKey === key) {
      joinInFlight = null;
      joinInFlightKey = null;
    }
  });

  return joinInFlight;
}

async function teardownZegoEngine(engine: ZegoEngine, roomId: string): Promise<void> {
  if (engine.destroyed) return;
  engine.destroyed = true;
  engine.roomLoginConfirmed = false;

  const effectiveRoomId = roomId || engine.joinedRoomId;
  devLog('[Zego] leaveZegoRoom start', { roomId: effectiveRoomId });

  detachZegoErrorShield();

  const streamHandler = engine.roomStreamUpdateHandler;
  if (streamHandler) {
    safeSdkCall(() => {
      engine.off?.('roomStreamUpdate', streamHandler);
    });
    engine.roomStreamUpdateHandler = undefined;
  }

  for (const { event, handler } of engine.hangupHandlers ?? []) {
    safeSdkCall(() => {
      engine.off?.(event, handler);
    });
  }
  engine.hangupHandlers = undefined;

  for (const streamId of [...engine.remoteStreamIds]) {
    safeStopPlaying(engine, streamId);
  }
  engine.remoteStreamIds.clear();
  engine.pendingRemoteStreamIds.clear();

  safeStopPublishing(engine);

  if (engine.localZegoStream) {
    safeSdkCall(() => {
      engine.destroyStream(engine.localZegoStream);
    });
    stopLocalStreamTracks(engine.localZegoStream);
    engine.localZegoStream = null;
  }

  if (effectiveRoomId) {
    safeSdkCall(() => {
      engine.logoutRoom(effectiveRoomId);
    });
    await waitForZegoRoomDisconnected(engine, effectiveRoomId);
  }

  safeSdkCall(() => {
    engine.destroyEngine();
  });

  engine.localStreamId = '';
  engine.joinedRoomId = '';

  if (globalEngine === engine) {
    globalEngine = null;
  }

  devLog('[Zego] leaveZegoRoom complete', { roomId: effectiveRoomId });
}

/** Fully tears down Zego room, streams, media tracks, and engine. Idempotent. */
export async function leaveZegoRoom(engine: ZegoEngine | null, roomId: string): Promise<void> {
  if (!engine || engine.destroyed) return;

  if (teardownPromise) {
    await teardownPromise;
    if (engine.destroyed) return;
  }

  teardownPromise = teardownZegoEngine(engine, roomId);
  try {
    await teardownPromise;
  } finally {
    teardownPromise = null;
  }
}

export function setZegoCameraEnabled(engine: ZegoEngine | null, enabled: boolean) {
  if (!engine?.localZegoStream) return;
  safeSdkCall(() => {
    engine.mutePublishStreamVideo(engine.localZegoStream, !enabled);
  });
}

export function setZegoMicrophoneMuted(engine: ZegoEngine | null, muted: boolean) {
  if (!engine?.localZegoStream) return;
  safeSdkCall(() => {
    engine.mutePublishStreamAudio(engine.localZegoStream, muted);
  });
}