import { StorageAdapter } from './storage.interface';

/**
 * S3-compatible adapter (AWS S3, Cloudflare R2).
 * Requires @aws-sdk/client-s3 when STORAGE_PROVIDER=s3|r2.
 */
export class S3StorageAdapter implements StorageAdapter {
  constructor(
    private readonly bucket: string,
    private readonly client: {
      send: (cmd: unknown) => Promise<unknown>;
    },
    private readonly GetObjectCommand: new (input: object) => unknown,
    private readonly PutObjectCommand: new (input: object) => unknown,
    private readonly DeleteObjectCommand: new (input: object) => unknown,
    private readonly HeadObjectCommand: new (input: object) => unknown,
  ) {}

  async save(key: string, data: Buffer): Promise<string> {
    await this.client.send(
      new this.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }),
    );
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const res = (await this.client.send(
      new this.GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )) as { Body?: { transformToByteArray: () => Promise<Uint8Array> } };
    if (!res.Body) throw new Error('Object not found');
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new this.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new this.HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}