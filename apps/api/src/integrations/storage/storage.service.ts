import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageAdapter } from './storage.interface';

@Injectable()
export class StorageService {
  private readonly adapter: StorageAdapter;

  constructor(private readonly config: ConfigService) {
    this.adapter = this.createAdapter();
  }

  private createAdapter(): StorageAdapter {
    const provider = this.config.get<string>('STORAGE_PROVIDER', 'local');

    if (provider === 's3' || provider === 'r2') {
      const bucket = this.config.get<string>('STORAGE_BUCKET');
      const endpoint = this.config.get<string>('STORAGE_ENDPOINT');
      const region = this.config.get<string>('STORAGE_REGION', 'auto');
      const accessKey = this.config.get<string>('STORAGE_ACCESS_KEY');
      const secretKey = this.config.get<string>('STORAGE_SECRET_KEY');

      if (!bucket || !accessKey || !secretKey) {
        throw new Error(`STORAGE_PROVIDER=${provider} requires STORAGE_BUCKET, ACCESS_KEY, SECRET_KEY`);
      }

      // Optional S3 SDK — require keeps local dev free of the dependency
      const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@aws-sdk/client-s3');

      const client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle: provider === 'r2',
      });

      return new S3StorageAdapter(
        bucket,
        client,
        GetObjectCommand,
        PutObjectCommand,
        DeleteObjectCommand,
        HeadObjectCommand,
      );
    }

    const root = this.config.get<string>('STORAGE_LOCAL_PATH', join(process.cwd(), 'uploads'));
    return new LocalStorageAdapter(root);
  }

  save(key: string, data: Buffer) {
    return this.adapter.save(key, data);
  }

  read(key: string) {
    return this.adapter.read(key);
  }

  delete(key: string) {
    return this.adapter.delete(key);
  }

  exists(key: string) {
    return this.adapter.exists(key);
  }
}