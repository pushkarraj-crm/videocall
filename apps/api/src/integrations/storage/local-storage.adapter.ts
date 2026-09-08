import { mkdir, readFile, unlink, writeFile, access } from 'fs/promises';
import { dirname, join } from 'path';
import { StorageAdapter } from './storage.interface';

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (key.includes('..')) throw new Error('Invalid storage key');
    return join(this.root, key);
  }

  async save(key: string, data: Buffer): Promise<string> {
    const fullPath = this.resolve(key);
    await mkdir(dirname(fullPath), { recursive: true, mode: 0o700 });
    await writeFile(fullPath, data, { mode: 0o600 });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}