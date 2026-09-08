import { randomUUID } from 'crypto';
import { getStorageAdapter } from '../../integrations/storage/storage.factory';

export async function saveKycDocument(
  hostId: string,
  kind: 'selfie' | 'aadhaar_front' | 'aadhaar_back',
  dataUrl: string,
): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
    throw new Error('Invalid document image');
  }

  const key = `kyc/${hostId}/${kind}_${randomUUID()}.bin`;
  await getStorageAdapter().save(key, buffer);
  return key;
}

export async function readKycDocument(storageKey: string): Promise<Buffer> {
  if (!storageKey.startsWith('kyc/') || storageKey.includes('..')) {
    throw new Error('Invalid storage key');
  }
  return getStorageAdapter().read(storageKey);
}