import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/exceptions/business.exception';

export interface ZegoTokenPayload {
  roomId: string;
  userId: string;
  userName: string;
}

@Injectable()
export class ZegoService {
  constructor(private readonly config: ConfigService) {}

  generateToken(payload: ZegoTokenPayload): { token: string; appId: string; roomId: string } {
    const appId = this.config.get<string>('ZEGO_APP_ID');
    const serverSecret = this.config.get<string>('ZEGO_SERVER_SECRET');

    if (!appId || !serverSecret) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        return {
          token: `dev_${payload.roomId}_${payload.userId}`,
          appId: '0',
          roomId: payload.roomId,
        };
      }
      throw new BusinessException('ZegoCloud is not configured', 503, 'ZEGO_NOT_CONFIGURED');
    }

    const effectiveTimeInSeconds = 3600;
    const expireTime = Math.floor(Date.now() / 1000) + effectiveTimeInSeconds;

    const payloadJson = JSON.stringify({
      app_id: Number(appId),
      user_id: payload.userId,
      nonce: Math.floor(Math.random() * 2147483647),
      ctime: Math.floor(Date.now() / 1000),
      expire: expireTime,
      payload: JSON.stringify({
        room_id: payload.roomId,
        privilege: { 1: 1, 2: 1 },
      }),
    });

    const token = createHmac('sha256', serverSecret).update(payloadJson).digest('hex');

    return {
      token: Buffer.from(payloadJson).toString('base64') + '.' + token,
      appId,
      roomId: payload.roomId,
    };
  }

  generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}