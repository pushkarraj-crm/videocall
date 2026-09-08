import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  getDefaultPolicy,
  INITIAL_POLICY_VERSION,
  LEGAL_POLICY_DEFAULTS,
  LEGAL_POLICY_SLUGS,
} from '../../common/utils/legal-policy-defaults';
import { sanitizeLegalHtml } from '../../common/utils/sanitize-html';
import { UpdateLegalPolicyDto } from './dto/update-legal-policy.dto';

function bumpVersion(current: string): string {
  const parsed = Number.parseFloat(current);
  if (Number.isFinite(parsed)) {
    return ((Math.round(parsed * 10) + 1) / 10).toFixed(1);
  }
  return `${current}.1`;
}

function serializePolicy(policy: {
  slug: string;
  title: string;
  content: string;
  version: string;
  isPublished: boolean;
  publishedAt: Date;
  updatedAt: Date;
  publishedBy?: { id: string; displayName: string } | null;
}) {
  return {
    slug: policy.slug,
    title: policy.title,
    content: policy.content,
    version: policy.version,
    isPublished: policy.isPublished,
    publishedAt: policy.publishedAt.toISOString(),
    lastUpdated: policy.updatedAt.toISOString(),
    publishedBy: policy.publishedBy
      ? { id: policy.publishedBy.id, displayName: policy.publishedBy.displayName }
      : null,
  };
}

@Injectable()
export class LegalPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeeded() {
    const count = await this.prisma.legalPolicy.count();
    if (count > 0) return;

    const now = new Date();
    for (const policy of LEGAL_POLICY_DEFAULTS) {
      await this.prisma.legalPolicy.create({
        data: {
          slug: policy.slug,
          title: policy.title,
          content: policy.content,
          version: INITIAL_POLICY_VERSION,
          isPublished: true,
          publishedAt: now,
        },
      });
      await this.prisma.legalPolicyRevision.create({
        data: {
          slug: policy.slug,
          title: policy.title,
          content: policy.content,
          version: INITIAL_POLICY_VERSION,
          publishedAt: now,
        },
      });
    }
  }

  async listPublished() {
    await this.ensureSeeded();
    const items = await this.prisma.legalPolicy.findMany({
      where: { isPublished: true },
      orderBy: { slug: 'asc' },
      select: {
        slug: true,
        title: true,
        version: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return {
      items: items.map((p) => ({
        slug: p.slug,
        title: p.title,
        version: p.version,
        publishedAt: p.publishedAt.toISOString(),
        lastUpdated: p.updatedAt.toISOString(),
      })),
    };
  }

  async getPublishedBySlug(slug: string) {
    await this.ensureSeeded();
    if (!LEGAL_POLICY_SLUGS.includes(slug as (typeof LEGAL_POLICY_SLUGS)[number])) {
      throw new NotFoundException('Policy not found');
    }

    const policy = await this.prisma.legalPolicy.findFirst({
      where: { slug, isPublished: true },
      include: {
        publishedBy: { select: { id: true, displayName: true } },
      },
    });

    if (!policy) {
      const fallback = getDefaultPolicy(slug);
      if (!fallback) throw new NotFoundException('Policy not found');
      const now = new Date().toISOString();
      return {
        slug: fallback.slug,
        title: fallback.title,
        content: fallback.content,
        version: INITIAL_POLICY_VERSION,
        isPublished: true,
        publishedAt: now,
        lastUpdated: now,
        publishedBy: null,
      };
    }

    return serializePolicy(policy);
  }

  async listAdmin() {
    await this.ensureSeeded();
    const items = await this.prisma.legalPolicy.findMany({
      orderBy: { slug: 'asc' },
      include: {
        publishedBy: { select: { id: true, displayName: true } },
        _count: { select: { revisions: true } },
      },
    });

    return {
      items: items.map((p) => ({
        ...serializePolicy(p),
        revisionCount: p._count.revisions,
      })),
    };
  }

  async getHistory(slug: string) {
    await this.ensureSeeded();
    const policy = await this.prisma.legalPolicy.findUnique({ where: { slug } });
    if (!policy) throw new NotFoundException('Policy not found');

    const revisions = await this.prisma.legalPolicyRevision.findMany({
      where: { slug },
      orderBy: { publishedAt: 'desc' },
      include: {
        publishedBy: { select: { id: true, displayName: true } },
      },
    });

    return {
      slug,
      currentVersion: policy.version,
      items: revisions.map((r) => ({
        id: r.id,
        version: r.version,
        title: r.title,
        publishedAt: r.publishedAt.toISOString(),
        publishedBy: r.publishedBy
          ? { id: r.publishedBy.id, displayName: r.publishedBy.displayName }
          : null,
      })),
    };
  }

  async getRevision(slug: string, revisionId: string) {
    const revision = await this.prisma.legalPolicyRevision.findFirst({
      where: { id: revisionId, slug },
      include: {
        publishedBy: { select: { id: true, displayName: true } },
      },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    return {
      id: revision.id,
      slug: revision.slug,
      title: revision.title,
      content: revision.content,
      version: revision.version,
      publishedAt: revision.publishedAt.toISOString(),
      publishedBy: revision.publishedBy
        ? { id: revision.publishedBy.id, displayName: revision.publishedBy.displayName }
        : null,
    };
  }

  async updatePolicy(slug: string, adminId: string, dto: UpdateLegalPolicyDto) {
    await this.ensureSeeded();
    const existing = await this.prisma.legalPolicy.findUnique({ where: { slug } });
    if (!existing) throw new NotFoundException('Policy not found');

    const title = dto.title ?? existing.title;
    const content = sanitizeLegalHtml(dto.content ?? existing.content);
    const shouldPublish = dto.publish ?? Boolean(dto.title || dto.content);
    const now = new Date();

    if (!shouldPublish) {
      const updated = await this.prisma.legalPolicy.update({
        where: { slug },
        data: { title, content },
        include: { publishedBy: { select: { id: true, displayName: true } } },
      });
      return serializePolicy(updated);
    }

    const version = bumpVersion(existing.version);
    const updated = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.legalPolicy.update({
        where: { slug },
        data: {
          title,
          content,
          version,
          isPublished: true,
          publishedAt: now,
          publishedById: adminId,
        },
        include: { publishedBy: { select: { id: true, displayName: true } } },
      });

      await tx.legalPolicyRevision.create({
        data: {
          slug,
          title,
          content,
          version,
          publishedAt: now,
          publishedById: adminId,
        },
      });

      await tx.adminLog.create({
        data: {
          adminId,
          action: 'legal_policy_published',
          details: { slug, version, title },
        },
      });

      return policy;
    });

    return serializePolicy(updated);
  }
}