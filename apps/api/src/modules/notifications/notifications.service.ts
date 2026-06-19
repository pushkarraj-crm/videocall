import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const tokenHash = this.hashToken(dto.token);

    return this.prisma.deviceToken.upsert({
      where: { userId_tokenHash: { userId, tokenHash } },
      update: { isActive: true, platform: dto.platform, lastUsedAt: new Date() },
      create: {
        userId,
        tokenHash,
        platform: dto.platform,
      },
    });
  }

  async unregisterDevice(userId: string, token: string) {
    const tokenHash = this.hashToken(token);

    return this.prisma.deviceToken.updateMany({
      where: { userId, tokenHash },
      data: { isActive: false },
    });
  }

  async getActiveTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { id: true, platform: true, lastUsedAt: true },
    });
  }
}