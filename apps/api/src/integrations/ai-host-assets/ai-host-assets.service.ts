import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import path from 'path';

const FILENAME_PREFIX_MAP: Record<string, string> = {
  idle: 'idle',
  talking: 'talking',
  listening: 'listening',
  thinking: 'thinking',
  smile: 'smile',
  laugh: 'laugh',
  gift_small: 'gift_small',
  gift_big: 'gift_vip',
  gift_vip: 'gift_vip',
  wave: 'wave',
  bye: 'bye',
  surprised: 'surprised',
  welcome: 'welcome',
};

export type GalleryImage = {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
};

export type HostAssetSummary = {
  assetSlug: string;
  videoCount: number;
  videos: Array<{ filename: string; url: string; type: string }>;
  galleryCount: number;
};

@Injectable()
export class AiHostAssetsService {
  private readonly logger = new Logger(AiHostAssetsService.name);

  constructor(private readonly config: ConfigService) {}

  getAssetsRoot(): string {
    return (
      this.config.get<string>('AI_HOSTS_ASSETS_ROOT') ||
      path.resolve(process.cwd(), '../web/public/ai-hosts')
    );
  }

  getManifestPath(): string {
    return (
      this.config.get<string>('AI_HOSTS_MANIFEST_PATH') ||
      path.join(this.getAssetsRoot(), 'manifest.json')
    );
  }

  /** Anjali Sharma → anjali-sharma */
  generateAssetSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'ai-host'
    );
  }

  ensureUniqueSlug(baseSlug: string, taken: Set<string>): string {
    let slug = baseSlug;
    let n = 2;
    while (taken.has(slug)) {
      slug = `${baseSlug}-${n}`;
      n++;
    }
    return slug;
  }

  scaffoldHostFolders(assetSlug: string) {
    const root = this.getAssetsRoot();
    const dirs = [
      path.join(root, assetSlug, 'casual', 'bedroom'),
      path.join(root, assetSlug, 'gallery'),
    ];
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.logger.log(`Scaffolded asset folders for ${assetSlug}`);
  }

  removeHostAssets(assetSlug: string) {
    const hostPath = path.join(this.getAssetsRoot(), assetSlug);
    if (fs.existsSync(hostPath)) {
      fs.rmSync(hostPath, { recursive: true, force: true });
      this.logger.log(`Removed asset folder ${assetSlug}`);
    }
    this.scanAndWriteManifest();
  }

  private parseVideoType(filename: string): string | null {
    const base = filename.replace(/\.(mp4|webm)$/i, '');
    for (const prefix of Object.keys(FILENAME_PREFIX_MAP).sort((a, b) => b.length - a.length)) {
      if (base.startsWith(`${prefix}_`) || base === prefix) return FILENAME_PREFIX_MAP[prefix];
    }
    return null;
  }

  scanAndWriteManifest() {
    const root = this.getAssetsRoot();
    const hosts: Record<string, { outfits: Record<string, { scenes: Record<string, unknown[]> }> }> =
      {};
    let totalClips = 0;

    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

    for (const host of fs.readdirSync(root)) {
      if (host.startsWith('.') || host === 'manifest.json') continue;
      const hostPath = path.join(root, host);
      if (!fs.statSync(hostPath).isDirectory()) continue;
      hosts[host] = { outfits: {} };

      for (const outfit of fs.readdirSync(hostPath)) {
        if (outfit.startsWith('.') || outfit === 'gallery') continue;
        const outfitPath = path.join(hostPath, outfit);
        if (!fs.statSync(outfitPath).isDirectory()) continue;
        hosts[host].outfits[outfit] = { scenes: {} };

        for (const scene of fs.readdirSync(outfitPath)) {
          if (scene.startsWith('.')) continue;
          const scenePath = path.join(outfitPath, scene);
          if (!fs.statSync(scenePath).isDirectory()) continue;
          const clips: unknown[] = [];

          for (const file of fs.readdirSync(scenePath)) {
            if (!/\.(mp4|webm)$/i.test(file)) continue;
            const type = this.parseVideoType(file);
            if (!type) continue;
            const rel = `/ai-hosts/${host}/${outfit}/${scene}/${file}`;
            clips.push({ path: rel, url: rel, host, outfit, scene, type, file, weight: 1 });
            totalClips++;
          }
          if (clips.length) hosts[host].outfits[outfit].scenes[scene] = clips;
        }
      }
    }

    const manifest = { hosts, scannedAt: new Date().toISOString(), totalClips };
    fs.writeFileSync(this.getManifestPath(), JSON.stringify(manifest, null, 2));
    return manifest;
  }

  countVideos(assetSlug: string): number {
    const scenePath = path.join(this.getAssetsRoot(), assetSlug, 'casual', 'bedroom');
    if (!fs.existsSync(scenePath)) return 0;
    return fs
      .readdirSync(scenePath)
      .filter((f) => /\.(mp4|webm)$/i.test(f) && this.parseVideoType(f)).length;
  }

  listVideos(assetSlug: string) {
    const scenePath = path.join(this.getAssetsRoot(), assetSlug, 'casual', 'bedroom');
    if (!fs.existsSync(scenePath)) return [];
    return fs
      .readdirSync(scenePath)
      .filter((f) => /\.(mp4|webm)$/i.test(f))
      .map((filename) => {
        const type = this.parseVideoType(filename) ?? 'idle';
        const url = `/ai-hosts/${assetSlug}/casual/bedroom/${filename}`;
        return { filename, url, type };
      })
      .sort((a, b) => a.filename.localeCompare(b.filename));
  }

  /** Live filesystem read — no manifest cache. Used by call routing. */
  pickRandomIdleVideo(assetSlug: string | null | undefined): string | null {
    const slug = assetSlug?.trim();
    if (!slug) return null;

    const videos = this.listVideos(slug);
    if (!videos.length) return null;

    const idleClips = videos.filter(
      (v) => v.type === 'idle' || /^idle_/i.test(v.filename),
    );
    const pool = idleClips.length ? idleClips : videos;
    return pool[Math.floor(Math.random() * pool.length)].url;
  }

  nextIdleFilename(assetSlug: string): string {
    const existing = this.listVideos(assetSlug)
      .map((v) => v.filename)
      .filter((f) => /^idle_\d+\.mp4$/i.test(f));
    const nums = existing.map((f) => parseInt(f.match(/idle_(\d+)/i)?.[1] ?? '0', 10));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `idle_${String(next).padStart(2, '0')}.mp4`;
  }

  saveVideo(assetSlug: string, buffer: Buffer, originalName?: string) {
    const sceneDir = path.join(this.getAssetsRoot(), assetSlug, 'casual', 'bedroom');
    fs.mkdirSync(sceneDir, { recursive: true });

    let filename = originalName?.trim() || this.nextIdleFilename(assetSlug);
    if (!/\.(mp4|webm)$/i.test(filename)) filename += '.mp4';
    if (!this.parseVideoType(filename)) {
      filename = this.nextIdleFilename(assetSlug);
    }

    const dest = path.join(sceneDir, filename);
    fs.writeFileSync(dest, buffer);
    const manifest = this.scanAndWriteManifest();
    const url = `/ai-hosts/${assetSlug}/casual/bedroom/${filename}`;
    return { filename, url, manifest };
  }

  saveProfileImage(assetSlug: string, buffer: Buffer, originalName: string): GalleryImage {
    const galleryDir = path.join(this.getAssetsRoot(), assetSlug, 'gallery');
    fs.mkdirSync(galleryDir, { recursive: true });

    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const filename = `profile${safeExt}`;
    fs.writeFileSync(path.join(galleryDir, filename), buffer);

    return {
      id: 'profile',
      url: `/ai-hosts/${assetSlug}/gallery/${filename}`,
      filename,
      uploadedAt: new Date().toISOString(),
    };
  }

  saveGalleryImage(assetSlug: string, buffer: Buffer, originalName: string): GalleryImage {
    const galleryDir = path.join(this.getAssetsRoot(), assetSlug, 'gallery');
    fs.mkdirSync(galleryDir, { recursive: true });

    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}${safeExt}`;
    fs.writeFileSync(path.join(galleryDir, filename), buffer);

    return {
      id,
      url: `/ai-hosts/${assetSlug}/gallery/${filename}`,
      filename,
      uploadedAt: new Date().toISOString(),
    };
  }

  deleteGalleryFile(assetSlug: string, filename: string) {
    const filePath = path.join(this.getAssetsRoot(), assetSlug, 'gallery', filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  deleteVideo(assetSlug: string, filename: string) {
    const filePath = path.join(this.getAssetsRoot(), assetSlug, 'casual', 'bedroom', filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    this.scanAndWriteManifest();
  }

  getAssetSummary(assetSlug: string): HostAssetSummary {
    const videos = this.listVideos(assetSlug);
    const galleryDir = path.join(this.getAssetsRoot(), assetSlug, 'gallery');
    const galleryCount = fs.existsSync(galleryDir)
      ? fs.readdirSync(galleryDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length
      : 0;
    return { assetSlug, videoCount: videos.length, videos, galleryCount };
  }
}