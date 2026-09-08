import { KycVerificationStatus } from '@prisma/client';
import { kycDisplayStatus, maskAadhaar, maskPan } from './kyc-display';

describe('kycDisplayStatus', () => {
  it('maps verification statuses to display labels', () => {
    expect(kycDisplayStatus(null)).toBe('NOT_SUBMITTED');
    expect(kycDisplayStatus(KycVerificationStatus.pending)).toBe('PENDING');
    expect(kycDisplayStatus(KycVerificationStatus.in_review)).toBe('PENDING');
    expect(kycDisplayStatus(KycVerificationStatus.verified)).toBe('VERIFIED');
    expect(kycDisplayStatus(KycVerificationStatus.failed)).toBe('REJECTED');
  });
});

describe('maskAadhaar', () => {
  it('masks all but last four digits', () => {
    expect(maskAadhaar('123456789012')).toBe('XXXX-XX-9012');
  });
});

describe('maskPan', () => {
  it('masks middle characters', () => {
    expect(maskPan('ABCDE1234F')).toBe('AB****4F');
  });
});