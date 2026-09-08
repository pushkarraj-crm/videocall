import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { HostApplicationStatus, KycVerificationStatus, Role } from '@prisma/client';
import {
  hashSensitive,
  kycDisplayStatus,
  maskAadhaar,
  maskPan,
} from '../../common/utils/kyc-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { UsersService } from '../users/users.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { readKycDocument, saveKycDocument } from './kyc-storage';

const PENDING_STATUSES: KycVerificationStatus[] = [
  KycVerificationStatus.pending,
  KycVerificationStatus.in_review,
];

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationDispatcherService,
  ) {}

  async isHostKycVerified(userId: string): Promise<boolean> {
    const latest = await this.prisma.hostKyc.findFirst({
      where: { userId, verificationStatus: KycVerificationStatus.verified },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return Boolean(latest);
  }

  async getSummary(userId: string) {
    const latest = await this.prisma.hostKyc.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return {
        status: 'NOT_SUBMITTED' as const,
        submittedAt: null,
        verifiedAt: null,
        adminNote: null,
        aadhaarMasked: null,
        panMasked: null,
        canSubmit: true,
        canWithdraw: false,
      };
    }

    const display = kycDisplayStatus(latest.verificationStatus);
    return {
      id: latest.id,
      status: display,
      submittedAt: latest.createdAt,
      verifiedAt: latest.verifiedAt,
      adminNote: latest.adminNote ?? latest.failureReason,
      aadhaarMasked: latest.aadhaarMasked,
      panMasked: latest.panMasked,
      fullName: latest.fullName,
      canSubmit: display === 'REJECTED',
      canWithdraw: display === 'VERIFIED',
    };
  }

  async submit(userId: string, dto: SubmitKycDto) {
    const roles = await this.usersService.getUserRoles(userId);
    if (!roles.includes(Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    const latest = await this.prisma.hostKyc.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (latest?.verificationStatus === KycVerificationStatus.verified) {
      throw new BusinessException('KYC already verified', 409, 'KYC_ALREADY_VERIFIED');
    }

    const pending = await this.prisma.hostKyc.findFirst({
      where: { userId, verificationStatus: { in: PENDING_STATUSES } },
    });
    if (pending) {
      throw new BusinessException('KYC submission already pending review', 409, 'KYC_PENDING');
    }

    const aadhaarHash = hashSensitive(dto.aadhaarNumber);
    const duplicateAadhaar = await this.prisma.hostKyc.findFirst({
      where: {
        aadhaarHash,
        userId: { not: userId },
        verificationStatus: KycVerificationStatus.verified,
      },
    });
    if (duplicateAadhaar) {
      throw new BusinessException('Aadhaar already registered', 409, 'AADHAAR_DUPLICATE');
    }

    const [selfieKey, frontKey, backKey] = await Promise.all([
      saveKycDocument(userId, 'selfie', dto.selfieImage),
      saveKycDocument(userId, 'aadhaar_front', dto.aadhaarFrontImage),
      saveKycDocument(userId, 'aadhaar_back', dto.aadhaarBackImage),
    ]);

    const panHash = dto.panNumber ? hashSensitive(dto.panNumber) : null;
    const panMasked = dto.panNumber ? maskPan(dto.panNumber) : null;

    const record = await this.prisma.hostKyc.create({
      data: {
        userId,
        provider: 'manual',
        fullName: dto.fullName.trim(),
        dob: new Date(dto.dob),
        upiIdEnc: this.encryptPlaceholder(dto.upiId.trim().toLowerCase()),
        aadhaarHash,
        aadhaarMasked: maskAadhaar(dto.aadhaarNumber),
        panHash,
        panMasked,
        selfieStorageKey: selfieKey,
        aadhaarFrontStorageKey: frontKey,
        aadhaarBackStorageKey: backKey,
        verificationStatus: KycVerificationStatus.pending,
      },
    });

    await this.prisma.hostApplication.updateMany({
      where: { userId },
      data: { status: HostApplicationStatus.kyc_submitted },
    });

    this.notifications.dispatchSafe(
      this.notifications.onKycSubmitted(record.id, userId),
      `kyc_submitted/${record.id}`,
    );

    return this.serializeForHost(record);
  }

  async getStatus(userId: string) {
    return this.getSummary(userId);
  }

  async getHistory(userId: string) {
    const records = await this.prisma.hostKyc.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return records.map((r) => this.serializeForHost(r));
  }

  /** @deprecated Provider redirect flow — use submit() */
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

    const panMasked = payload.pan ? maskPan(payload.pan) : null;

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
        adminNote: payload.failureReason,
        verifiedAt: payload.status === 'verified' ? new Date() : null,
      },
    });
  }

  async listForAdmin(status?: KycVerificationStatus) {
    const where = status ? { verificationStatus: status } : undefined;
    const records = await this.prisma.hostKyc.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, displayName: true, phone: true, email: true },
        },
      },
    });

    return records.map((r) => ({
      id: r.id,
      hostId: r.userId,
      host: r.user,
      fullName: r.fullName,
      dob: r.dob,
      upiIdMasked: r.upiIdEnc ? '****' : null,
      aadhaarMasked: r.aadhaarMasked,
      panMasked: r.panMasked,
      status: r.verificationStatus,
      displayStatus: kycDisplayStatus(r.verificationStatus),
      adminNote: r.adminNote ?? r.failureReason,
      hasSelfie: Boolean(r.selfieStorageKey),
      hasAadhaarFront: Boolean(r.aadhaarFrontStorageKey),
      hasAadhaarBack: Boolean(r.aadhaarBackStorageKey),
      submittedAt: r.createdAt,
      verifiedAt: r.verifiedAt,
    }));
  }

  async approve(adminId: string, kycId: string) {
    const record = await this.prisma.hostKyc.findUniqueOrThrow({ where: { id: kycId } });

    if (!PENDING_STATUSES.includes(record.verificationStatus)) {
      throw new BusinessException('Only pending KYC can be approved', 400, 'INVALID_KYC_STATUS');
    }

    const updated = await this.prisma.hostKyc.update({
      where: { id: kycId },
      data: {
        verificationStatus: KycVerificationStatus.verified,
        verifiedAt: new Date(),
        adminNote: null,
        failureReason: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'kyc.approve',
        entityType: 'host_kyc',
        entityId: kycId,
      },
    });

    this.notifications.dispatchSafe(
      this.notifications.onKycApproved(kycId, record.userId),
      `kyc_approved/${kycId}`,
    );

    return updated;
  }

  async reject(adminId: string, kycId: string, note?: string) {
    const record = await this.prisma.hostKyc.findUniqueOrThrow({ where: { id: kycId } });

    if (!PENDING_STATUSES.includes(record.verificationStatus)) {
      throw new BusinessException('Only pending KYC can be rejected', 400, 'INVALID_KYC_STATUS');
    }

    const rejectionNote = note?.trim() || 'Rejected by admin';
    const updated = await this.prisma.hostKyc.update({
      where: { id: kycId },
      data: {
        verificationStatus: KycVerificationStatus.failed,
        failureReason: rejectionNote,
        adminNote: rejectionNote,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'kyc.reject',
        entityType: 'host_kyc',
        entityId: kycId,
        newValue: { note: rejectionNote },
      },
    });

    this.notifications.dispatchSafe(
      this.notifications.onKycRejected(kycId, record.userId, rejectionNote),
      `kyc_rejected/${kycId}`,
    );

    return updated;
  }

  async getDocument(kycId: string, type: 'selfie' | 'aadhaar_front' | 'aadhaar_back') {
    const record = await this.prisma.hostKyc.findUniqueOrThrow({ where: { id: kycId } });
    const keyMap = {
      selfie: record.selfieStorageKey,
      aadhaar_front: record.aadhaarFrontStorageKey,
      aadhaar_back: record.aadhaarBackStorageKey,
    };
    const storageKey = keyMap[type];
    if (!storageKey) {
      throw new BusinessException('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }
    return readKycDocument(storageKey);
  }

  private serializeForHost(record: {
    id: string;
    fullName: string | null;
    aadhaarMasked: string | null;
    panMasked: string | null;
    verificationStatus: KycVerificationStatus;
    failureReason: string | null;
    adminNote: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: record.id,
      status: kycDisplayStatus(record.verificationStatus),
      fullName: record.fullName,
      aadhaarMasked: record.aadhaarMasked,
      panMasked: record.panMasked,
      adminNote: record.adminNote ?? record.failureReason,
      submittedAt: record.createdAt,
      verifiedAt: record.verifiedAt,
    };
  }

  private encryptPlaceholder(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}