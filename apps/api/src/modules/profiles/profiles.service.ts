import { Injectable } from '@nestjs/common';
import { ModerationTargetType, ModerationQueueStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const FLAGGED_KEYWORDS = ['escort', 'nude', 'explicit', 'adult only'];
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_GALLERY_IMAGES = 12;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type GalleryImage = {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
};

function parseGallery(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const url = typeof rec.url === 'string' ? rec.url : null;
      if (!url) return null;
      return {
        id: typeof rec.id === 'string' ? rec.id : url,
        url,
        filename: typeof rec.filename === 'string' ? rec.filename : path.basename(url),
        uploadedAt:
          typeof rec.uploadedAt === 'string' ? rec.uploadedAt : new Date().toISOString(),
      } satisfies GalleryImage;
    })
    .filter((g): g is GalleryImage => !!g);
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private scanContent(text: string): string | null {
    const lower = text.toLowerCase();
    for (const word of FLAGGED_KEYWORDS) {
      if (lower.includes(word)) return word;
    }
    return null;
  }

  private mediaRoot() {
    // Served by Next from apps/web/public/user-media (same pattern as ai-hosts)
    return path.resolve(process.cwd(), '../web/public/user-media');
  }

  private userDir(userId: string) {
    const dir = path.join(this.mediaRoot(), userId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private safeExt(originalName: string): string {
    const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
    if (!ALLOWED_IMAGE_EXT.has(ext)) {
      throw new BusinessException(
        'Only JPG, PNG, or WebP images are allowed',
        400,
        'INVALID_IMAGE_TYPE',
      );
    }
    return ext === '.jpeg' ? '.jpg' : ext;
  }

  private assertImageBuffer(buffer: Buffer) {
    if (!buffer?.length) {
      throw new BusinessException('No file uploaded', 400, 'NO_FILE');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new BusinessException('Image must be 5MB or smaller', 400, 'FILE_TOO_LARGE');
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.bio) {
      const flagged = this.scanContent(dto.bio);
      if (flagged) {
        await this.prisma.moderationQueue.create({
          data: {
            targetType: ModerationTargetType.bio,
            targetId: userId,
            userId,
            status: ModerationQueueStatus.pending,
            priority: 3,
            autoFlagReason: `keyword:${flagged}`,
          },
        });
        throw new BusinessException(
          'Bio contains prohibited content and is pending review',
          400,
          'CONTENT_FLAGGED',
        );
      }
    }

    if (dto.hostBio) {
      const flagged = this.scanContent(dto.hostBio);
      if (flagged) {
        throw new BusinessException(
          'About text contains prohibited content',
          400,
          'CONTENT_FLAGGED',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        gender: dto.gender,
        primaryLanguage: dto.primaryLanguage,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        displayName: true,
        bio: true,
        gender: true,
        primaryLanguage: true,
        avatarUrl: true,
        updatedAt: true,
        hostProfile: {
          select: {
            hostBio: true,
            virtualHostGallery: true,
          },
        },
      },
    });

    if (dto.hostBio !== undefined) {
      const host = await this.prisma.hostProfile.findUnique({ where: { userId } });
      if (host) {
        await this.prisma.hostProfile.update({
          where: { userId },
          data: { hostBio: dto.hostBio },
        });
      }
    }

    const hostProfile = await this.prisma.hostProfile.findUnique({
      where: { userId },
      select: { hostBio: true, virtualHostGallery: true },
    });

    return {
      ...user,
      hostBio: hostProfile?.hostBio ?? null,
      gallery: hostProfile ? parseGallery(hostProfile.virtualHostGallery) : [],
    };
  }

  async getEditableProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        bio: true,
        gender: true,
        primaryLanguage: true,
        avatarUrl: true,
        phone: true,
        email: true,
      },
    });
    if (!user) throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');

    const roles = await this.prisma.userRole.findMany({
      where: { userId, revokedAt: null },
      select: { role: true },
    });
    const isHost = roles.some((r) => r.role === Role.host);

    let hostBio: string | null = null;
    let gallery: GalleryImage[] = [];
    if (isHost) {
      const host = await this.prisma.hostProfile.findUnique({
        where: { userId },
        select: { hostBio: true, virtualHostGallery: true },
      });
      hostBio = host?.hostBio ?? null;
      gallery = parseGallery(host?.virtualHostGallery);
    }

    return { ...user, isHost, hostBio, gallery };
  }

  async uploadAvatar(userId: string, buffer: Buffer, originalName: string) {
    this.assertImageBuffer(buffer);
    const ext = this.safeExt(originalName);
    const dir = this.userDir(userId);
    const filename = `avatar${ext}`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    const avatarUrl = `/user-media/${userId}/${filename}?v=${Date.now()}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }

  async uploadGalleryImage(userId: string, buffer: Buffer, originalName: string) {
    this.assertImageBuffer(buffer);

    const roles = await this.prisma.userRole.findMany({
      where: { userId, revokedAt: null },
      select: { role: true },
    });
    if (!roles.some((r) => r.role === Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    const host = await this.prisma.hostProfile.findUnique({ where: { userId } });
    if (!host) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const gallery = parseGallery(host.virtualHostGallery);
    if (gallery.length >= MAX_GALLERY_IMAGES) {
      throw new BusinessException(
        `Maximum ${MAX_GALLERY_IMAGES} gallery images`,
        400,
        'GALLERY_FULL',
      );
    }

    const ext = this.safeExt(originalName);
    const id = `img_${Date.now()}_${randomBytes(3).toString('hex')}`;
    const filename = `${id}${ext}`;
    const dir = path.join(this.userDir(userId), 'gallery');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);

    const image: GalleryImage = {
      id,
      url: `/user-media/${userId}/gallery/${filename}`,
      filename,
      uploadedAt: new Date().toISOString(),
    };
    const next = [...gallery, image];

    await this.prisma.hostProfile.update({
      where: { userId },
      data: { virtualHostGallery: next as unknown as object },
    });

    return { image, gallery: next };
  }

  async removeGalleryImage(userId: string, imageId: string) {
    const host = await this.prisma.hostProfile.findUnique({ where: { userId } });
    if (!host) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const gallery = parseGallery(host.virtualHostGallery);
    const target = gallery.find((g) => g.id === imageId || g.filename === imageId);
    if (!target) {
      throw new BusinessException('Gallery image not found', 404, 'GALLERY_NOT_FOUND');
    }

    const filePath = path.join(this.userDir(userId), 'gallery', target.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const next = gallery.filter((g) => g.id !== target.id);
    await this.prisma.hostProfile.update({
      where: { userId },
      data: { virtualHostGallery: next as unknown as object },
    });

    return { removed: true, gallery: next };
  }

  async clearAvatar(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    return { avatarUrl: null };
  }

  async getConsents(userId: string) {
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { consentedAt: 'desc' },
    });
  }
}
