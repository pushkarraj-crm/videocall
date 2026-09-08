import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  buildRtcRoomPayload,
  generateToken04,
  toZegoUserId,
} from './zego-token04';

export interface ZegoTokenPayload {
  roomId: string;
  userId: string;
  userName: string;
}

export interface ZegoTokenResult {
  token: string;
  appId: string;
  roomId: string;
  /** User ID the token was signed for — must match loginRoom userID exactly. */
  userId: string;
  /** Token lifetime in seconds from generation time. */
  expireSeconds: number;
}

/** Default token lifetime: 1 hour. Always refresh via getCall immediately before join. */
const TOKEN_EFFECTIVE_SECONDS = 3600;

@Injectable()
export class ZegoService implements OnModuleInit {
  private readonly logger = new Logger(ZegoService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const appId = this.config.get<string>('ZEGO_APP_ID')?.trim();
    const secret = this.config.get<string>('ZEGO_SERVER_SECRET')?.trim();
    this.logger.log(
      JSON.stringify({
        event: 'ZEGO_CONFIG_BOOT',
        appIdConfigured: Boolean(appId),
        appId: appId ?? null,
        secretConfigured: Boolean(secret),
        secretLength: secret?.length ?? 0,
        secretLooksLikeAppSign: (secret?.length ?? 0) === 64,
        note:
          secret?.length === 64
            ? 'ZEGO_SERVER_SECRET looks like AppSign (64 hex). Token04 needs ServerSecret (32 chars) from the same project.'
            : 'Token04 requires ServerSecret exactly 32 characters from ZEGOCLOUD console for this App ID.',
      }),
    );
  }

  generateToken(payload: ZegoTokenPayload): ZegoTokenResult {
    const appId = this.config.get<string>('ZEGO_APP_ID')?.trim();
    const serverSecret = this.config.get<string>('ZEGO_SERVER_SECRET')?.trim();

    if (!appId || !serverSecret) {
      throw new BusinessException(
        'ZegoCloud credentials are required for video calls. Set ZEGO_APP_ID and ZEGO_SERVER_SECRET on the API.',
        503,
        'ZEGO_NOT_CONFIGURED',
      );
    }

    const numericAppId = Number(appId);
    if (!Number.isFinite(numericAppId) || numericAppId <= 0 || !Number.isInteger(numericAppId)) {
      throw new BusinessException('Invalid ZEGO_APP_ID', 500, 'ZEGO_INVALID_APP_ID');
    }

    if (serverSecret.length === 64) {
      throw new BusinessException(
        'ZEGO_SERVER_SECRET appears to be an AppSign (64 chars). Use ServerSecret (exactly 32 characters) from the same ZEGOCLOUD project as ZEGO_APP_ID.',
        500,
        'ZEGO_INVALID_SECRET',
      );
    }

    if (serverSecret.length !== 32) {
      throw new BusinessException(
        `ZEGO_SERVER_SECRET must be exactly 32 characters (got ${serverSecret.length}). Copy ServerSecret from ZEGOCLOUD console for App ID ${appId}.`,
        500,
        'ZEGO_INVALID_SECRET',
      );
    }

    const zegoUserId = toZegoUserId(payload.userId);
    const roomId = (payload.roomId ?? '').trim();
    if (!roomId) {
      throw new BusinessException('Zego roomId is required', 500, 'ZEGO_INVALID_ROOM');
    }

    // Room privilege payload binds the token to this room (login + publish).
    // Disable only if the console project rejects privilege payloads:
    // ZEGO_TOKEN_ROOM_PRIVILEGE=false
    const useRoomPrivilege =
      this.config.get<string>('ZEGO_TOKEN_ROOM_PRIVILEGE', 'true') !== 'false';
    const tokenPayload = useRoomPrivilege ? buildRtcRoomPayload(roomId) : '';

    const token = generateToken04(
      numericAppId,
      zegoUserId,
      serverSecret,
      TOKEN_EFFECTIVE_SECONDS,
      tokenPayload,
    );

    this.logger.log(
      JSON.stringify({
        event: 'ZEGO_TOKEN_GENERATED',
        appId: String(numericAppId),
        roomId,
        userId: zegoUserId,
        expireSeconds: TOKEN_EFFECTIVE_SECONDS,
        tokenPrefix: token.slice(0, 2),
        tokenLen: token.length,
        roomPrivilege: useRoomPrivilege,
      }),
    );

    return {
      token,
      appId: String(numericAppId),
      roomId,
      userId: zegoUserId,
      expireSeconds: TOKEN_EFFECTIVE_SECONDS,
    };
  }

  /**
   * Authoritative room id for a call.
   * Prefer call-scoped deterministic id so both parties always share the same room.
   */
  generateRoomId(callId?: string): string {
    if (callId) {
      const compact = callId.replace(/[^a-zA-Z0-9]/g, '');
      return `room_${compact}`;
    }
    return `room_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
