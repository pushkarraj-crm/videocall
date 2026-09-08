import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import path from 'path';

type ManifestClip = { url: string; type: string; host: string; outfit: string; scene: string };

@Injectable()
export class AiVideoCatalogService implements OnModuleInit {
  private readonly logger = new Logger(AiVideoCatalogService.name);
  /** hostSlug → list of video URLs (O(1) random index) */
  private poolByHost = new Map<string, string[]>();
  private flatPool: string[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.loadCatalog();
  }

  refresh() {
    this.loadCatalog();
    return { hosts: this.poolByHost.size, clips: this.flatPool.length };
  }

  resolveAssetSlug(hostSlug: string, displayName?: string): string {
    const normalized = hostSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '') || 'host';
    if (this.poolByHost.has(normalized) && (this.poolByHost.get(normalized)?.length ?? 0) > 0) {
      return normalized;
    }
    if (displayName) {
      const fromName = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim() || 'host';
      if (this.poolByHost.has(fromName) && (this.poolByHost.get(fromName)?.length ?? 0) > 0) {
        return fromName;
      }
    }
    for (const key of this.poolByHost.keys()) {
      if (!key.includes('/') && (this.poolByHost.get(key)?.length ?? 0) > 0) {
        return key;
      }
    }
    return normalized;
  }

  pickRandomVideo(hostSlug: string, outfit = 'casual', scene = 'bedroom'): string | null {
    const resolved = this.resolveAssetSlug(hostSlug);
    const key = `${resolved}/${outfit}/${scene}`;
    const exact = this.poolByHost.get(key);
    if (exact?.length) {
      return exact[Math.floor(Math.random() * exact.length)];
    }
    const hostPool = this.poolByHost.get(resolved);
    if (hostPool?.length) {
      return hostPool[Math.floor(Math.random() * hostPool.length)];
    }
    if (this.flatPool.length) {
      return this.flatPool[Math.floor(Math.random() * this.flatPool.length)];
    }
    return null;
  }

  getStats() {
    return { hosts: this.poolByHost.size, clips: this.flatPool.length };
  }

  private loadCatalog() {
    const manifestPath =
      this.config.get<string>('AI_HOSTS_MANIFEST_PATH') ||
      path.resolve(process.cwd(), '../web/public/ai-hosts/manifest.json');

    this.poolByHost.clear();
    this.flatPool = [];

    if (!fs.existsSync(manifestPath)) {
      this.logger.warn(`AI hosts manifest not found at ${manifestPath}`);
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        hosts?: Record<
          string,
          { outfits: Record<string, { scenes: Record<string, ManifestClip[]> }> }
        >;
      };

      for (const [host, node] of Object.entries(manifest.hosts ?? {})) {
        const hostUrls: string[] = [];
        for (const [outfit, outfitNode] of Object.entries(node.outfits ?? {})) {
          for (const [scene, clips] of Object.entries(outfitNode.scenes ?? {})) {
            const urls = clips.map((c) => c.url).filter(Boolean);
            if (urls.length) {
              this.poolByHost.set(`${host}/${outfit}/${scene}`, urls);
              hostUrls.push(...urls);
            }
          }
        }
        if (hostUrls.length) {
          this.poolByHost.set(host, [...new Set(hostUrls)]);
          this.flatPool.push(...hostUrls);
        }
      }

      this.flatPool = [...new Set(this.flatPool)];
      this.logger.log(`AI video catalog loaded: ${this.poolByHost.size} pools, ${this.flatPool.length} clips`);
    } catch (err) {
      this.logger.error(`Failed to load AI video catalog: ${err}`);
    }
  }
}