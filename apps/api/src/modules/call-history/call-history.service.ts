import { Injectable, Logger } from '@nestjs/common';
import {
  CallEndReason,
  CallHistoryEndedBy,
  CallHistoryStatus,
  CallHistoryType,
  CallStatus,
  Prisma,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { startOfDay, endOfDay, resolveAnalyticsRange } from '../../common/utils/analytics-period';
import {
  historyDisplayStatus,
  mapCallToHistoryStatus,
} from '../../common/utils/call-history-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';

const TERMINAL_STATUSES: CallHistoryStatus[] = [
  CallHistoryStatus.completed,
  CallHistoryStatus.missed,
  CallHistoryStatus.rejected,
  CallHistoryStatus.cancelled,
  CallHistoryStatus.failed,
];

@Injectable()
export class CallHistoryService {
  private readonly logger = new Logger(CallHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget hook after call initiated — does not affect call flow. */
  async onCallInitiated(callId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });
    await this.prisma.callHistory.upsert({
      where: { callId },
      create: {
        callId,
        callerId: call.callerId,
        hostId: call.calleeId,
        type: CallHistoryType.video,
        status: CallHistoryStatus.ringing,
        startedAt: call.createdAt,
        hostCallType: call.hostCallType,
      },
      update: {
        status: CallHistoryStatus.ringing,
        startedAt: call.createdAt,
        hostCallType: call.hostCallType,
      },
    });
  }

  async onCallAccepted(callId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });
    await this.prisma.callHistory.upsert({
      where: { callId },
      create: {
        callId,
        callerId: call.callerId,
        hostId: call.calleeId,
        type: CallHistoryType.video,
        status: CallHistoryStatus.connected,
        startedAt: call.startedAt ?? call.createdAt,
        answeredAt: call.answeredAt ?? new Date(),
      },
      update: {
        status: CallHistoryStatus.connected,
        answeredAt: call.answeredAt ?? new Date(),
        startedAt: call.startedAt ?? call.createdAt,
      },
    });
  }

  async onCallRejected(callId: string) {
    await this.syncFromCall(callId);
  }

  async onCallEnded(callId: string, endedByUserId?: string) {
    await this.syncFromCall(callId, endedByUserId);
  }

  private async syncFromCall(callId: string, endedByUserId?: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });
    const financials = await this.loadFinancials(callId);

    const status = mapCallToHistoryStatus(call.status, call.endReason, call.answeredAt);
    const endedBy = this.resolveEndedBy(call, endedByUserId);

    await this.prisma.callHistory.upsert({
      where: { callId },
      create: {
        callId,
        callerId: call.callerId,
        hostId: call.calleeId,
        type: CallHistoryType.video,
        status,
        startedAt: call.startedAt ?? call.createdAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        coinsSpentUnits: call.coinsChargedUnits,
        hostEarningUnits: financials.hostEarningUnits,
        platformCommissionUnits: financials.platformCommissionUnits,
        endedBy,
      },
      update: {
        status,
        startedAt: call.startedAt ?? call.createdAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        coinsSpentUnits: call.coinsChargedUnits,
        hostEarningUnits: financials.hostEarningUnits,
        platformCommissionUnits: financials.platformCommissionUnits,
        endedBy,
      },
    });
  }

  private resolveEndedBy(
    call: { callerId: string; calleeId: string; endReason: CallEndReason | null; status: CallStatus },
    endedByUserId?: string,
  ): CallHistoryEndedBy | null {
    if (
      call.endReason === CallEndReason.balance_zero ||
      call.endReason === CallEndReason.timeout ||
      call.endReason === CallEndReason.network_error ||
      call.endReason === CallEndReason.admin_terminated
    ) {
      return CallHistoryEndedBy.system;
    }
    if (endedByUserId === call.callerId) return CallHistoryEndedBy.caller;
    if (endedByUserId === call.calleeId) return CallHistoryEndedBy.host;
    if (call.status === CallStatus.rejected) return CallHistoryEndedBy.host;
    return null;
  }

  private async loadFinancials(callId: string) {
    const [ticks, gifts] = await Promise.all([
      this.prisma.callBillingTick.aggregate({
        where: { callId },
        _sum: { hostEarningUnits: true, platformFeeUnits: true },
      }),
      this.prisma.callGift.aggregate({
        where: { callId },
        _sum: { hostEarningUnits: true, platformFeeUnits: true },
      }),
    ]);

    return {
      hostEarningUnits:
        (ticks._sum.hostEarningUnits ?? 0n) + (gifts._sum.hostEarningUnits ?? 0n),
      platformCommissionUnits:
        (ticks._sum.platformFeeUnits ?? 0n) + (gifts._sum.platformFeeUnits ?? 0n),
    };
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.CallHistoryWhereInput = {
      callerId: userId,
      status: { in: TERMINAL_STATUSES },
    };

    const [items, total] = await Promise.all([
      this.prisma.callHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          host: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.callHistory.count({ where }),
    ]);

    return { items: items.map((r) => this.serializeForUser(r)), total, page, limit };
  }

  async listForHost(
    hostId: string,
    page = 1,
    limit = 20,
    period?: string,
    from?: string,
    to?: string,
  ) {
    const skip = (page - 1) * limit;
    const range = period
      ? resolveAnalyticsRange(period as 'today' | '7d' | '30d' | '90d' | 'custom', from, to)
      : null;

    const where: Prisma.CallHistoryWhereInput = {
      hostId,
      status: { in: TERMINAL_STATUSES },
      ...(range
        ? { createdAt: { gte: range.from, lte: range.to } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.callHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          caller: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.callHistory.count({ where }),
    ]);

    return { items: items.map((r) => this.serializeForHost(r)), total, page, limit };
  }

  async getByIdForUser(userId: string, historyId: string) {
    const record = await this.prisma.callHistory.findFirst({
      where: {
        id: historyId,
        OR: [{ callerId: userId }, { hostId: userId }],
      },
      include: {
        caller: { select: { id: true, displayName: true, avatarUrl: true, phone: true } },
        host: { select: { id: true, displayName: true, avatarUrl: true, phone: true } },
      },
    });

    if (!record) {
      throw new BusinessException('Call history not found', 404, 'HISTORY_NOT_FOUND');
    }

    return this.serializeDetail(record);
  }

  async listForAdmin(query: {
    q?: string;
    status?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildAdminWhere(query);

    const [items, total, analytics] = await Promise.all([
      this.prisma.callHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          caller: { select: { id: true, displayName: true, avatarUrl: true } },
          host: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.callHistory.count({ where }),
      this.getAdminAnalytics(where),
    ]);

    return {
      analytics,
      items: items.map((r) => this.serializeAdminListItem(r)),
      total,
      page,
      limit,
    };
  }

  async getByIdForAdmin(historyId: string) {
    const record = await this.prisma.callHistory.findUnique({
      where: { id: historyId },
      include: {
        caller: { select: { id: true, displayName: true, avatarUrl: true, email: true, phone: true } },
        host: { select: { id: true, displayName: true, avatarUrl: true, email: true, phone: true } },
      },
    });

    if (!record) {
      throw new BusinessException('Call history not found', 404, 'HISTORY_NOT_FOUND');
    }

    return this.serializeDetail(record);
  }

  private buildAdminWhere(query: {
    q?: string;
    status?: string;
    type?: string;
    from?: string;
    to?: string;
  }): Prisma.CallHistoryWhereInput {
    const where: Prisma.CallHistoryWhereInput = {
      status: { in: TERMINAL_STATUSES },
    };

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { callId: q },
        { callerId: q },
        { hostId: q },
        { caller: { displayName: { contains: q, mode: 'insensitive' } } },
        { host: { displayName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (query.status) {
      const statusMap: Record<string, CallHistoryStatus> = {
        completed: CallHistoryStatus.completed,
        missed: CallHistoryStatus.missed,
        rejected: CallHistoryStatus.rejected,
        cancelled: CallHistoryStatus.cancelled,
        failed: CallHistoryStatus.failed,
      };
      const mapped = statusMap[query.status.toLowerCase()];
      if (mapped) where.status = mapped;
    }

    if (query.type === 'audio' || query.type === 'video') {
      where.type = query.type as CallHistoryType;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = startOfDay(new Date(query.from));
      if (query.to) where.createdAt.lte = endOfDay(new Date(query.to));
    }

    return where;
  }

  private async getAdminAnalytics(where: Prisma.CallHistoryWhereInput) {
    const [total, completed, missed, rejected, agg, topHosts, topUsers] = await Promise.all([
      this.prisma.callHistory.count({ where }),
      this.prisma.callHistory.count({ where: { ...where, status: CallHistoryStatus.completed } }),
      this.prisma.callHistory.count({ where: { ...where, status: CallHistoryStatus.missed } }),
      this.prisma.callHistory.count({ where: { ...where, status: CallHistoryStatus.rejected } }),
      this.prisma.callHistory.aggregate({
        where,
        _avg: { durationSeconds: true },
        _sum: { coinsSpentUnits: true, platformCommissionUnits: true },
      }),
      this.prisma.callHistory.groupBy({
        by: ['hostId'],
        where,
        _count: true,
        _sum: { hostEarningUnits: true },
        orderBy: { _count: { hostId: 'desc' } },
        take: 5,
      }),
      this.prisma.callHistory.groupBy({
        by: ['callerId'],
        where,
        _count: true,
        _sum: { coinsSpentUnits: true },
        orderBy: { _sum: { coinsSpentUnits: 'desc' } },
        take: 5,
      }),
    ]);

    const hostIds = topHosts.map((h) => h.hostId);
    const callerIds = topUsers.map((u) => u.callerId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...hostIds, ...callerIds] } },
      select: { id: true, displayName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.displayName]));

    const totalCoins = Number(agg._sum.coinsSpentUnits ?? 0n) / 100;
    const avgRevenue = total > 0 ? totalCoins / total : 0;

    return {
      totalCalls: total,
      completedCalls: completed,
      missedCalls: missed,
      rejectedCalls: rejected,
      averageDurationSeconds: Math.round(agg._avg.durationSeconds ?? 0),
      averageRevenueCoins: Math.round(avgRevenue * 100) / 100,
      topHosts: topHosts.map((h) => ({
        hostId: h.hostId,
        name: nameMap.get(h.hostId) ?? 'Host',
        calls: h._count,
        earningsCoins: unitsToCoins(h._sum.hostEarningUnits ?? 0n),
      })),
      topUsers: topUsers.map((u) => ({
        userId: u.callerId,
        name: nameMap.get(u.callerId) ?? 'User',
        calls: u._count,
        coinsSpent: unitsToCoins(u._sum.coinsSpentUnits ?? 0n),
      })),
    };
  }

  private serializeForUser(
    record: {
      id: string;
      callId: string;
      type: CallHistoryType;
      status: CallHistoryStatus;
      durationSeconds: number;
      coinsSpentUnits: bigint;
      createdAt: Date;
      startedAt: Date | null;
      endedAt: Date | null;
      host: { id: string; displayName: string; avatarUrl: string | null };
    },
  ) {
    return {
      id: record.id,
      callId: record.callId,
      type: record.type,
      displayStatus: historyDisplayStatus(record.status),
      durationSeconds: record.durationSeconds,
      coinsSpent: unitsToCoins(record.coinsSpentUnits),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      createdAt: record.createdAt,
      host: record.host,
    };
  }

  private serializeForHost(
    record: {
      id: string;
      callId: string;
      type: CallHistoryType;
      status: CallHistoryStatus;
      durationSeconds: number;
      hostEarningUnits: bigint;
      coinsSpentUnits: bigint;
      createdAt: Date;
      caller: { id: string; displayName: string; avatarUrl: string | null };
    },
  ) {
    return {
      id: record.id,
      callId: record.callId,
      type: record.type,
      displayStatus: historyDisplayStatus(record.status),
      durationSeconds: record.durationSeconds,
      coinsEarned: unitsToCoins(record.hostEarningUnits),
      coinsSpent: unitsToCoins(record.coinsSpentUnits),
      createdAt: record.createdAt,
      caller: record.caller,
    };
  }

  private serializeAdminListItem(
    record: {
      id: string;
      callId: string;
      type: CallHistoryType;
      status: CallHistoryStatus;
      durationSeconds: number;
      coinsSpentUnits: bigint;
      hostEarningUnits: bigint;
      createdAt: Date;
      caller: { id: string; displayName: string; avatarUrl: string | null };
      host: { id: string; displayName: string; avatarUrl: string | null };
    },
  ) {
    return {
      id: record.id,
      callId: record.callId,
      type: record.type,
      displayStatus: historyDisplayStatus(record.status),
      durationSeconds: record.durationSeconds,
      coinsSpent: unitsToCoins(record.coinsSpentUnits),
      hostEarning: unitsToCoins(record.hostEarningUnits),
      createdAt: record.createdAt,
      caller: record.caller,
      host: record.host,
    };
  }

  private serializeDetail(
    record: {
      id: string;
      callId: string;
      callerId: string;
      hostId: string;
      type: CallHistoryType;
      status: CallHistoryStatus;
      startedAt: Date | null;
      answeredAt: Date | null;
      endedAt: Date | null;
      durationSeconds: number;
      coinsSpentUnits: bigint;
      hostEarningUnits: bigint;
      platformCommissionUnits: bigint;
      endedBy: CallHistoryEndedBy | null;
      createdAt: Date;
      caller: { id: string; displayName: string; avatarUrl: string | null; phone?: string | null; email?: string | null };
      host: { id: string; displayName: string; avatarUrl: string | null; phone?: string | null; email?: string | null };
    },
  ) {
    return {
      id: record.id,
      callId: record.callId,
      type: record.type,
      displayStatus: historyDisplayStatus(record.status),
      startedAt: record.startedAt,
      answeredAt: record.answeredAt,
      endedAt: record.endedAt,
      durationSeconds: record.durationSeconds,
      coinsSpent: unitsToCoins(record.coinsSpentUnits),
      hostEarning: unitsToCoins(record.hostEarningUnits),
      platformCommission: unitsToCoins(record.platformCommissionUnits),
      endedBy: record.endedBy,
      createdAt: record.createdAt,
      caller: record.caller,
      host: record.host,
    };
  }
}