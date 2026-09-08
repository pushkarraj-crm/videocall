import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { averageRating } from '../../common/utils/host-rating-stats';
import {
  REVIEW_USER_SELECT,
  serializeReview,
} from '../../common/utils/review-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ReviewAdminAction, AdminReviewActionDto } from './dto/admin-review-action.dto';
import { AdminReviewsQueryDto } from './dto/admin-reviews-query.dto';

@Injectable()
export class ReviewsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listReviews(query: AdminReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};

    if (query.hostId) where.hostId = query.hostId;
    if (query.userId) where.userId = query.userId;
    if (query.rating) where.rating = query.rating;

    if (query.filter === 'reported') where.isReported = true;
    if (query.filter === 'hidden') where.isHidden = true;
    if (query.filter === 'visible') where.isHidden = false;

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { reviewText: { contains: q, mode: 'insensitive' } },
        { user: { displayName: { contains: q, mode: 'insensitive' } } },
        { host: { displayName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orderBy =
      query.sort === 'oldest'
        ? [{ createdAt: 'asc' as const }]
        : [{ createdAt: 'desc' as const }];

    const [rows, total, analytics] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: { select: REVIEW_USER_SELECT },
          host: { select: REVIEW_USER_SELECT },
        },
      }),
      this.prisma.review.count({ where }),
      this.getAnalytics(),
    ]);

    return {
      items: rows.map((r) => serializeReview(r)),
      total,
      page,
      limit,
      analytics,
    };
  }

  async getReviewById(reviewId: string) {
    const row = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: { select: REVIEW_USER_SELECT },
        host: { select: REVIEW_USER_SELECT },
        call: {
          select: {
            id: true,
            status: true,
            durationSeconds: true,
            startedAt: true,
            endedAt: true,
            answeredAt: true,
          },
        },
      },
    });

    if (!row) {
      throw new BusinessException('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    return {
      review: serializeReview(row),
      call: row.call,
    };
  }

  async deleteReview(reviewId: string) {
    const existing = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!existing) {
      throw new BusinessException('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });

      const profile = await tx.hostProfile.findUnique({
        where: { userId: existing.hostId },
      });
      if (profile && profile.ratingCount > 0) {
        await tx.hostProfile.update({
          where: { userId: existing.hostId },
          data: {
            ratingSum: Math.max(0, profile.ratingSum - existing.rating),
            ratingCount: Math.max(0, profile.ratingCount - 1),
          },
        });
      }
    });

    return { deleted: true, id: reviewId };
  }

  async updateReview(reviewId: string, dto: AdminReviewActionDto) {
    const existing = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!existing) {
      throw new BusinessException('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    const data: Prisma.ReviewUpdateInput = {};
    switch (dto.action) {
      case ReviewAdminAction.hide:
        data.isHidden = true;
        break;
      case ReviewAdminAction.unhide:
        data.isHidden = false;
        break;
      case ReviewAdminAction.report:
        data.isReported = true;
        break;
      case ReviewAdminAction.unreport:
        data.isReported = false;
        break;
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data,
      include: {
        user: { select: REVIEW_USER_SELECT },
        host: { select: REVIEW_USER_SELECT },
      },
    });

    return serializeReview(updated);
  }

  private async getAnalytics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [agg, reviewsToday, reviewsThisMonth, topHosts, lowestHosts] =
      await Promise.all([
        this.prisma.review.aggregate({
          where: { isHidden: false },
          _avg: { rating: true },
          _count: true,
        }),
        this.prisma.review.count({
          where: { createdAt: { gte: todayStart } },
        }),
        this.prisma.review.count({
          where: { createdAt: { gte: monthStart } },
        }),
        this.prisma.hostProfile.findMany({
          where: { ratingCount: { gte: 1 } },
          orderBy: [{ ratingSum: 'desc' }, { ratingCount: 'desc' }],
          take: 5,
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        }),
        this.prisma.hostProfile.findMany({
          where: { ratingCount: { gte: 1 } },
          orderBy: [{ ratingSum: 'asc' }, { ratingCount: 'desc' }],
          take: 5,
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        }),
      ]);

    return {
      averagePlatformRating:
        agg._count > 0 && agg._avg.rating != null
          ? Math.round(agg._avg.rating * 10) / 10
          : null,
      totalReviews: agg._count,
      reviewsToday,
      reviewsThisMonth,
      topRatedHosts: topHosts.map((h) => ({
        hostId: h.userId,
        displayName: h.user.displayName,
        avatarUrl: h.user.avatarUrl,
        averageRating: averageRating(h.ratingSum, h.ratingCount),
        totalReviews: h.ratingCount,
      })),
      lowestRatedHosts: lowestHosts.map((h) => ({
        hostId: h.userId,
        displayName: h.user.displayName,
        avatarUrl: h.user.avatarUrl,
        averageRating: averageRating(h.ratingSum, h.ratingCount),
        totalReviews: h.ratingCount,
      })),
    };
  }
}