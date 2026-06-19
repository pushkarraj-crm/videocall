import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { HostApplicationStatus, KycVerificationStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async initiate(userId: string, provider = 'hyperverge') {
    const application = await this.prisma.hostApplication.findUnique({
      where: { userId },
    });

    if (!application) {
      throw new BusinessException('Host application required', 400, 'NO_APPLICATION');
    }

    const reference = `kyc_${userId}_${Date.now()}`;

    const record = await this.prisma.hostKyc.create({
      data: {
        userId,
        provider,
        providerReference: reference,
        verificationStatus: KycVerificationStatus.pending,
      },
    });

    await this.prisma.hostApplication.update({
      where: { userId },
      data: { status: HostApplicationStatus.kyc_submitted },
    });

    return {
      kycId: record.id,
      providerReference: reference,
      redirectUrl: `https://kyc-provider.example.com/verify?ref=${reference}`,
    };
  }

  async handleCallback(payload: {
    providerReference: string;
    status: 'verified' | 'failed';
    pan?: string;
    aadhaarMasked?: string;
    fullName?: string;
    failureReason?: string;
  }) {
    const kyc = await this.prisma.hostKyc.findFirst({
      where: { providerReference: payload.providerReference },
    });

    if (!kyc) {
      throw new BusinessException('KYC record not found', 404, 'KYC_NOT_FOUND');
    }

    const panHash = payload.pan
      ? createHash('sha256').update(payload.pan.toUpperCase()).digest('hex')
      : null;

    const panMasked = payload.pan
      ? `${payload.pan.slice(0, 2)}****${payload.pan.slice(-2)}`
      : null;

    return this.prisma.hostKyc.update({
      where: { id: kyc.id },
      data: {
        verificationStatus:
          payload.status === 'verified'
            ? KycVerificationStatus.verified
            : KycVerificationStatus.failed,
        panHash,
        panMasked,
        aadhaarMasked: payload.aadhaarMasked,
        fullName: payload.fullName,
        failureReason: payload.failureReason,
        verifiedAt: payload.status === 'verified' ? new Date() : null,
      },
    });
  }

  async getStatus(userId: string) {
    return this.prisma.hostKyc.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        provider: true,
        verificationStatus: true,
        panMasked: true,
        verifiedAt: true,
        failureReason: true,
        createdAt: true,
      },
    });
  }
}