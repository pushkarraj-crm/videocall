import { Injectable } from '@nestjs/common';
import {
  CallHistoryStatus,
  CallStatus,
  KycVerificationStatus,
  Role,
} from '@prisma/client';
import { fetchPublicHostStats } from '../../common/utils/host-public-stats';
import {
  COMPLETED_HISTORY_STATUS,
  computeAvgResponseTimeSeconds,
  computeResponseRate,
  positiveNegativePercent,
  starDistribution,
} from '../../common/utils/host-rating-stats';
import {
  REVIEW_USER_SELECT,
  serializeHostRatingSummary,
  serializeReview,
} from '../../common/utils/review-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getEligibility(userId: string, callId: string) {
    const validation = await this.validateReviewEligibility(userId, callId);
    const existing = await this.prisma.review.findUnique({ where: { callId } });

    return {
      eligible: validation.eligible,
      reason: validation.reason ?? null,
      hostId: validation.hostId ?? null,
      hostName: validation.hostName ?? null,
      existingReview: existing ? serializeReview(existing) : null,
    };
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    const validation = await this.validateReviewEligibility(userId, dto.callId);
    if (!validation.eligible || !validation.hostId) {
      throw new BusinessException(
        validation.reason ?? 'Cannot submit review',
        400,
        validation.code ?? 'REVIEW_NOT_ALLOWED',
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { callId: dto.callId },
    });
    if (existing) {
      throw new BusinessException('Review already submitted', 409, 'DUPLICATE_REVIEW');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          callId: dto.callId,
          hostId: validation.hostId!,
          userId,
          rating: dto.rating,
          reviewText: dto.reviewText?.trim() || null,
        },
        include: {
          user: { select: REVIEW_USER_SELECT },
          host: { select: REVIEW_USER_SELECT },
        },
      });

      await tx.hostProfile.update({
        where: { userId: validation.hostId! },
        data: {
          ratingSum: { increment: dto.rating },
          ratingCount: { increment: 1 },
        },
      });

      return created;
    });

    return serializeReview(review);
  }

  async getHostReviews(hostId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { hostId, isHidden: false };

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: REVIEW_USER_SELECT } },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: rows.map((r) => serializeReview(r)),
      total,
      page,
      limit,
    };
  }

  async getHostRating(hostId: string) {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId: hostId },
    });

    if (!profile) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      distributionRows,
      latestReviews,
      monthlyAvg,
      historyCounts,
      responseRows,
      kycVerified,
    ] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { hostId, isHidden: false },
        _count: true,
      }),
      this.prisma.review.findMany({
        where: { hostId, isHidden: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: REVIEW_USER_SELECT } },
      }),
      this.prisma.review.aggregate({
        where: { hostId, isHidden: false, createdAt: { gte: monthStart } },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.callHistory.groupBy({
        by: ['status'],
        where: { hostId },
        _count: true,
      }),
      this.prisma.callHistory.findMany({
        where: {
          hostId,
          status: { in: [CallHistoryStatus.completed, CallHistoryStatus.connected] },
          answeredAt: { not: null },
        },
        select: { createdAt: true, answeredAt: true },
        take: 200,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hostKyc.findFirst({
        where: { userId: hostId, verificationStatus: KycVerificationStatus.verified },
        select: { id: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      historyCounts.map((r) => [r.status, r._count]),
    ) as Partial<Record<CallHistoryStatus, number>>;
    const completed = statusCounts[CallHistoryStatus.completed] ?? 0;
    const missed = statusCounts[CallHistoryStatus.missed] ?? 0;
    const rejected = statusCounts[CallHistoryStatus.rejected] ?? 0;

    const distribution = starDistribution(
      distributionRows.map((r) => ({ rating: r.rating, _count: r._count })),
    );
    const totalReviews = profile.ratingCount;
    const { positivePercent, negativePercent } = positiveNegativePercent(
      distribution,
      totalReviews,
    );

    return {
      ...serializeHostRatingSummary(profile),
      starDistribution: distribution,
      latestReviews: latestReviews.map((r) => serializeReview(r)),
      averageMonthlyRating:
        monthlyAvg._count > 0 && monthlyAvg._avg.rating != null
          ? Math.round(monthlyAvg._avg.rating * 10) / 10
          : null,
      monthlyReviewCount: monthlyAvg._count,
      positivePercent,
      negativePercent,
      responseRate: computeResponseRate(completed, missed, rejected),
      responseTimeSeconds: computeAvgResponseTimeSeconds(responseRows),
      memberSince: profile.approvedAt ?? profile.createdAt,
      languages: profile.languages,
      isVerified: Boolean(kycVerified),
    };
  }

  getPublicHostStats(hostId: string) {
    return fetchPublicHostStats(this.prisma, hostId);
  }

  private async validateReviewEligibility(userId: string, callId: string) {
    const roles = await this.usersService.getUserRoles(userId);
    if (roles.includes(Role.host) && !roles.includes(Role.user)) {
      return {
        eligible: false,
        reason: 'Hosts cannot submit reviews',
        code: 'HOST_CANNOT_REVIEW',
      };
    }

    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        callHistory: true,
        callee: { select: { id: true, displayName: true } },
      },
    });

    if (!call) {
      return { eligible: false, reason: 'Call not found', code: 'CALL_NOT_FOUND' };
    }

    if (call.callerId !== userId) {
      return {
        eligible: false,
        reason: 'Only the caller can rate this call',
        code: 'NOT_CALL_PARTICIPANT',
      };
    }

    if (call.callerId === call.calleeId) {
      return {
        eligible: false,
        reason: 'Cannot review yourself',
        code: 'SELF_REVIEW',
      };
    }

    const calleeRoles = await this.usersService.getUserRoles(call.calleeId);
    if (!calleeRoles.includes(Role.host)) {
      return {
        eligible: false,
        reason: 'Callee is not a host',
        code: 'NOT_A_HOST',
      };
    }

    const historyStatus = call.callHistory?.status;
    const isCompleted =
      historyStatus === COMPLETED_HISTORY_STATUS ||
      (call.status === CallStatus.ended &&
        call.answeredAt != null &&
        historyStatus !== CallHistoryStatus.missed &&
        historyStatus !== CallHistoryStatus.rejected &&
        historyStatus !== CallHistoryStatus.cancelled);

    if (!isCompleted) {
      return {
        eligible: false,
        reason: 'Only completed calls can be reviewed',
        code: 'CALL_NOT_COMPLETED',
      };
    }

    return {
      eligible: true,
      hostId: call.calleeId,
      hostName: call.callee.displayName,
    };
  }
}