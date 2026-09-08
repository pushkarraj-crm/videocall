import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RegisterFingerprintDto } from './dto/register-fingerprint.dto';
import { RiskEngineService } from './risk-engine.service';
import { RiskEventType } from '@prisma/client';

@Injectable()
export class RiskFingerprintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: RiskEngineService,
  ) {}

  async register(userId: string, dto: RegisterFingerprintDto, ip?: string) {
    const fingerprintHash = createHash('sha256')
      .update(
        [dto.platform, dto.os, dto.timezone, dto.language, dto.resolution, dto.browser, dto.fingerprint]
          .filter(Boolean)
          .join('|'),
      )
      .digest('hex')
      .slice(0, 64);

    await this.prisma.deviceFingerprintRecord.upsert({
      where: { userId_fingerprintHash: { userId, fingerprintHash } },
      create: {
        userId,
        fingerprintHash,
        platform: dto.platform,
        os: dto.os,
        timezone: dto.timezone,
        language: dto.language,
        resolution: dto.resolution,
        browser: dto.browser,
        lastIp: ip,
        lastCountry: dto.country,
        lastCity: dto.city,
      },
      update: {
        platform: dto.platform,
        os: dto.os,
        timezone: dto.timezone,
        language: dto.language,
        resolution: dto.resolution,
        browser: dto.browser,
        lastIp: ip,
        lastCountry: dto.country,
        lastCity: dto.city,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { deviceFingerprint: fingerprintHash },
    });

    await this.engine.evaluate({
      userId,
      eventType: RiskEventType.device_change,
      ip,
      fingerprint: fingerprintHash,
      country: dto.country,
      city: dto.city,
      metadata: { referenceId: fingerprintHash },
    });

    return { registered: true, fingerprintHash: `${fingerprintHash.slice(0, 8)}…` };
  }
}