import { createCipheriv } from 'crypto';

export enum ZegoTokenErrorCode {
  success = 0,
  appIDInvalid = 1,
  userIDInvalid = 3,
  secretInvalid = 5,
  effectiveTimeInSecondsInvalid = 6,
}

export class ZegoTokenError extends Error {
  constructor(
    public readonly errorCode: ZegoTokenErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ZegoTokenError';
  }
}

/** Inclusive random int in [a, b] — matches zego_server_assistant intent. */
function rndNum(a: number, b: number) {
  return Math.floor(a + (b - a + 1) * Math.random());
}

function makeRandomIv() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Official Token04 AES helper (zego_server_assistant Node).
 * Key is the raw 32-char ServerSecret string (NOT hex-decoded).
 */
function aesEncrypt(plainText: string, secret: string, iv: string): Buffer {
  if (secret.length !== 32) {
    throw new ZegoTokenError(
      ZegoTokenErrorCode.secretInvalid,
      `secret must be a 32 byte string, got ${secret.length}`,
    );
  }
  const cipher = createCipheriv('aes-256-cbc', secret, iv);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
}

/**
 * Official Zego Token04 generator.
 * @see https://github.com/ZEGOCLOUD/zego_server_assistant
 */
export function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload = '',
): string {
  if (!appId || typeof appId !== 'number' || !Number.isFinite(appId)) {
    throw new ZegoTokenError(ZegoTokenErrorCode.appIDInvalid, 'appID invalid');
  }
  if (!userId || typeof userId !== 'string') {
    throw new ZegoTokenError(ZegoTokenErrorCode.userIDInvalid, 'userId invalid');
  }
  // Zego userID max 64 bytes
  if (Buffer.byteLength(userId, 'utf8') > 64) {
    throw new ZegoTokenError(ZegoTokenErrorCode.userIDInvalid, 'userId too long (max 64 bytes)');
  }
  if (!secret || typeof secret !== 'string' || secret.length !== 32) {
    throw new ZegoTokenError(
      ZegoTokenErrorCode.secretInvalid,
      'secret must be a 32 byte string from ZEGOCLOUD Console ServerSecret (not AppSign)',
    );
  }
  if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
    throw new ZegoTokenError(
      ZegoTokenErrorCode.effectiveTimeInSecondsInvalid,
      'effectiveTimeInSeconds invalid',
    );
  }

  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: rndNum(-2147483648, 2147483647),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || '',
  };

  const plainText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const encryptBuf = aesEncrypt(plainText, secret, iv);

  const expireBuf = Buffer.alloc(8);
  expireBuf.writeBigInt64BE(BigInt(tokenInfo.expire));
  const ivLenBuf = Buffer.alloc(2);
  ivLenBuf.writeUInt16BE(iv.length);
  const encLenBuf = Buffer.alloc(2);
  encLenBuf.writeUInt16BE(encryptBuf.length);

  const buf = Buffer.concat([expireBuf, ivLenBuf, Buffer.from(iv, 'utf8'), encLenBuf, encryptBuf]);
  return `04${buf.toString('base64')}`;
}

/**
 * RTC room privilege payload for Token04.
 * privilege: 1 = login room, 2 = publish stream.
 * stream_id_list null = no stream-ID restriction.
 *
 * room_id in the token MUST match loginRoom(roomId).
 */
export function buildRtcRoomPayload(roomId: string) {
  if (!roomId) {
    throw new ZegoTokenError(ZegoTokenErrorCode.userIDInvalid, 'roomId required for RTC payload');
  }
  return JSON.stringify({
    room_id: roomId,
    privilege: {
      1: 1,
      2: 1,
    },
    stream_id_list: null,
  });
}

/**
 * Sanitize a DB user UUID into a Zego-safe userID.
 * Allowed: numbers, English letters, and ~!@#$%^&*()_+-=`;,./<>?
 * UUID hyphens are allowed by Zego; we keep them for stable identity.
 */
export function toZegoUserId(databaseUserId: string): string {
  const id = (databaseUserId ?? '').trim();
  if (!id) {
    throw new ZegoTokenError(ZegoTokenErrorCode.userIDInvalid, 'empty userId');
  }
  // Strip characters outside Zego allow-list (keep hyphen for UUIDs).
  const cleaned = id.replace(/[^0-9a-zA-Z_\-~!@#$%^&*()+=`;,./<>?]/g, '');
  if (!cleaned) {
    throw new ZegoTokenError(ZegoTokenErrorCode.userIDInvalid, 'userId has no valid characters');
  }
  return cleaned.slice(0, 64);
}
