import { join } from 'path';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import type { StorageAdapter } from './storage.interface';

let cached: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;

  const provider = process.env.STORAGE_PROVIDER ?? 'local';

  if (provider === 's3' || provider === 'r2') {
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;
    const region = process.env.STORAGE_REGION ?? 'auto';
    const accessKey = process.env.STORAGE_ACCESS_KEY;
    const secretKey = process.env.STORAGE_SECRET_KEY;

    if (!bucket || !accessKey || !secretKey) {
      throw new Error(`STORAGE_PROVIDER=${provider} requires bucket and credentials`);
    }

    const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@aws-sdk/client-s3');

    const client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: provider === 'r2',
    });

    cached = new S3StorageAdapter(
      bucket,
      client,
      GetObjectCommand,
      PutObjectCommand,
      DeleteObjectCommand,
      HeadObjectCommand,
    );
    return cached;
  }

  const root = process.env.STORAGE_LOCAL_PATH ?? join(process.cwd(), 'uploads');
  cached = new LocalStorageAdapter(root);
  return cached;
}