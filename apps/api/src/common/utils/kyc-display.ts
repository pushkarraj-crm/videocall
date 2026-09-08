import { createHash } from 'crypto';
import { KycVerificationStatus } from '@prisma/client';

export type KycDisplayStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export function kycDisplayStatus(
  status: KycVerificationStatus | null | undefined,
): KycDisplayStatus {
  if (!status) return 'NOT_SUBMITTED';
  switch (status) {
    case KycVerificationStatus.pending:
    case KycVerificationStatus.in_review:
      return 'PENDING';
    case KycVerificationStatus.verified:
      return 'VERIFIED';
    case KycVerificationStatus.failed:
    case KycVerificationStatus.expired:
      return 'REJECTED';
    default:
      return 'NOT_SUBMITTED';
  }
}

export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return 'XXXX-XX-XXXX';
  return `XXXX-XX-${digits.slice(-4)}`;
}

export function maskPan(pan: string): string {
  const normalized = pan.trim().toUpperCase();
  if (normalized.length < 4) return 'XXXXX';
  return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
}

export function hashSensitive(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}