import { Injectable } from '@nestjs/common';
import {
  CallHostType,
  CallStatus,
  FraudFlagStatus,
  GrievanceStatus,
  HostProfileType,
  PaymentStatus,
  Prisma,
  WithdrawalStatus,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import {
  AnalyticsPeriod,
  decimalToNumber,
  endOfDay,
  formatDateKey,
  resolveAnalyticsRange,
  startOfDay,
  unitsToInr,
} from '../../common/utils/analytics-period';
import { PrismaService } from '../../database/prisma.service';
import { AdminAnalyticsService } from './admin-analytics.service';

const LIVE_CALL_STATUSES: CallStatus[] = [
  CallStatus.initiated,
  CallStatus.ringing,
  CallStatus.active,
];

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AdminAnalyticsService,
  ) {}

  async getOverview(period: AnalyticsPeriod = '30d', from?: string, to?: string) {
    const range = resolveAnalyticsRange(period, from, to);
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const onlineCutoff = new Date(now.getTime() - ONLINE_WINDOW_MS);

    const [
      dashboard,
      revenueToday,
      revenueMonth,
      revenueTotal,
      activeCalls,
      activeAiCalls,
      activeRealCalls,
      onlineUsers,
      hostBreakdown,
      aiHostLeaders,
      realHostLeaders,
      coinUsageTrend,
      fraudSummary,
      alerts,
      pendingPayments,
      pendingWithdrawals,
    ] = await Promise.all([
      this.analytics.getDashboard(period, from, to),
      this.sumRevenue(todayStart, endOfDay(now)),
      this.sumRevenue(monthStart, endOfDay(now)),
      this.sumRevenue(new Date(0), endOfDay(now)),
      this.prisma.call.count({ where: { status: { in: LIVE_CALL_STATUSES } } }),
      this.prisma.call.count({
        where: {
          status: { in: LIVE_CALL_STATUSES },
          hostCallType: CallHostType.AI_HOST,
        },
      }),
      this.prisma.call.count({
        where: { status: { in: LIVE_CALL_STATUSES }, hostCallType: CallHostType.REAL_HOST },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, lastSeenAt: { gte: onlineCutoff } },
      }),
      this.getHostBreakdown(),
      this.getTopHostsByType(HostProfileType.AI_HOST, range.from, range.to),
      this.getTopHostsByType(HostProfileType.REAL_HOST, range.from, range.to),
      this.getCoinUsageTrend(range.from, range.to),
      this.getFraudSummary(),
      this.getSystemAlerts(),
      this.prisma.payment.count({
        where: { status: { in: [PaymentStatus.created, PaymentStatus.authorized] } },
      }),
      this.prisma.withdrawal.count({
        where: {
          status: { in: [WithdrawalStatus.requested, WithdrawalStatus.approved, WithdrawalStatus.processing] },
        },
      }),
    ]);

    return {
      period: dashboard.period,
      revenue: {
        totalInr: revenueTotal,
        todayInr: revenueToday,
        monthlyInr: revenueMonth,
        periodInr: dashboard.revenue.periodTotalInr,
      },
      live: {
        activeCalls,
        activeAiHosts: activeAiCalls,
        activeRealHosts: activeRealCalls,
        onlineUsers,
        onlineHosts: hostBreakdown.online,
        busyHosts: hostBreakdown.busy,
      },
      hosts: hostBreakdown,
      users: dashboard.users,
      calls: dashboard.calls,
      payments: {
        pending: pendingPayments,
        periodRecharges: dashboard.recharges.count,
        periodRechargeInr: dashboard.recharges.amountInr,
      },
      withdrawals: {
        ...dashboard.withdrawals,
        pending: pendingWithdrawals,
      },
      charts: {
        revenue: dashboard.trend.map((row) => ({
          date: row.date,
          value: row.revenueInr,
          rechargeInr: row.rechargeInr,
          platformFeesInr: row.platformFeesInr,
        })),
        dailyCalls: dashboard.trend.map((row) => ({ date: row.date, value: row.calls })),
        recharges: dashboard.trend.map((row) => ({
          date: row.date,
          value: row.recharges,
          amountInr: row.rechargeInr,
        })),
        coinUsage: coinUsageTrend,
      },
      topAiHosts: aiHostLeaders,
      topRealHosts: realHostLeaders,
      topUsers: dashboard.topUsers,
      fraud: fraudSummary,
      alerts,
      virtualHosts: dashboard.virtualHosts,
      updatedAt: now.toISOString(),
    };
  }

  async getLiveCalls(limit = 20) {
    const calls = await this.prisma.call.findMany({
      where: { status: { in: LIVE_CALL_STATUSES } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        caller: { select: { id: true, displayName: true } },
        callee: { select: { id: true, displayName: true } },
      },
    });

    return calls.map((c) => ({
      id: c.id,
      status: c.status,
      hostCallType: c.hostCallType,
      caller: c.caller,
      host: c.callee,
      durationSeconds: c.durationSeconds,
      coinsChargedCoins: unitsToCoins(c.coinsChargedUnits),
      startedAt: c.startedAt,
      createdAt: c.createdAt,
    }));
  }

  async getHostsSnapshot(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.hostProfile.findMany({
        skip,
        take: limit,
        orderBy: [{ isOnline: 'desc' }, { totalCalls: 'desc' }],
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          hostHeartbeat: { select: { lastBeatAt: true } },
        },
      }),
      this.prisma.hostProfile.count(),
    ]);

    return {
      items: items.map((h) => ({
        hostId: h.userId,
        name: h.user.displayName,
        avatarUrl: h.user.avatarUrl,
        profileType: h.profileType,
        isOnline: h.isOnline,
        isBusy: h.isBusy,
        isAvailable: h.isAvailable,
        status: h.isBusy ? 'BUSY' : h.isOnline ? 'ONLINE' : 'OFFLINE',
        totalCalls: h.totalCalls,
        rating: h.ratingCount > 0 ? h.ratingSum / h.ratingCount : null,
        revenueInr: unitsToInr(h.totalEarningsUnits),
        coinsPerMinute: h.coinsPerMinuteUnits ? unitsToCoins(h.coinsPerMinuteUnits) : null,
        lastBeatAt: h.hostHeartbeat?.lastBeatAt ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async getPayments(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = {};
    if (status && status !== 'all') {
      where.status = status as PaymentStatus;
    }

    const [items, total, summary] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, displayName: true, phone: true } },
          package: { select: { id: true, name: true } },
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: true,
        _sum: { totalInr: true },
      }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.displayName,
        packageName: p.package?.name ?? null,
        status: p.status,
        totalInr: decimalToNumber(p.totalInr),
        coinsCredited: unitsToCoins(p.coinUnitsCredited),
        razorpayOrderId: p.razorpayOrderId,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      summary: summary.map((s) => ({
        status: s.status,
        count: s._count,
        amountInr: decimalToNumber(s._sum.totalInr),
      })),
    };
  }

  async getSupportTickets(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.GrievanceTicketWhereInput = {};
    if (status) where.status = status as GrievanceStatus;

    const [items, total, openCount] = await Promise.all([
      this.prisma.grievanceTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.grievanceTicket.count({ where }),
      this.prisma.grievanceTicket.count({
        where: { status: { in: [GrievanceStatus.received, GrievanceStatus.acknowledged] } },
      }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        userId: t.userId,
        userName: t.user?.displayName ?? t.complainantName,
        email: t.complainantEmail,
        subject: t.subject,
        description: t.description,
        status: t.status,
        officerNotes: t.officerNotes,
        acknowledgedAt: t.acknowledgedAt,
        resolvedAt: t.resolvedAt,
        createdAt: t.createdAt,
      })),
      total,
      openCount,
      page,
      limit,
    };
  }

  async replySupportTicket(ticketId: string, notes: string, action: 'acknowledge' | 'resolve') {
    if (action === 'resolve') {
      return this.prisma.grievanceTicket.update({
        where: { id: ticketId },
        data: {
          status: GrievanceStatus.resolved,
          resolvedAt: new Date(),
          officerNotes: notes,
        },
      });
    }
    return this.prisma.grievanceTicket.update({
      where: { id: ticketId },
      data: {
        status: GrievanceStatus.acknowledged,
        acknowledgedAt: new Date(),
        officerNotes: notes,
      },
    });
  }

  async getLogs(type: 'api' | 'error' | 'payment' | 'auth' | 'all' = 'all', page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const entries: Array<{
      id: string;
      type: string;
      action: string;
      entityType: string;
      entityId: string | null;
      actorId: string | null;
      createdAt: Date;
      detail: unknown;
    }> = [];

    if (type === 'all' || type === 'api' || type === 'error' || type === 'auth') {
      const auditWhere: Prisma.AuditLogWhereInput = {};
      if (type === 'auth') {
        auditWhere.action = { contains: 'auth', mode: 'insensitive' };
      } else if (type === 'error') {
        auditWhere.action = { contains: 'error', mode: 'insensitive' };
      }

      const audit = await this.prisma.auditLog.findMany({
        where: auditWhere,
        orderBy: { createdAt: 'desc' },
        take: type === 'all' ? 25 : limit,
        skip: type === 'all' ? 0 : skip,
      });

      entries.push(
        ...audit.map((a) => ({
          id: a.id,
          type: type === 'auth' ? 'auth' : 'api',
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          actorId: a.actorId,
          createdAt: a.createdAt,
          detail: a.newValue,
        })),
      );
    }

    if (type === 'all' || type === 'payment') {
      const payments = await this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: type === 'all' ? 25 : limit,
        skip: type === 'all' ? 0 : skip,
        select: {
          id: true,
          userId: true,
          status: true,
          totalInr: true,
          razorpayOrderId: true,
          createdAt: true,
          paidAt: true,
        },
      });

      entries.push(
        ...payments.map((p) => ({
          id: p.id,
          type: 'payment',
          action: `payment.${p.status}`,
          entityType: 'payment',
          entityId: p.id,
          actorId: p.userId,
          createdAt: p.createdAt,
          detail: {
            status: p.status,
            totalInr: decimalToNumber(p.totalInr),
            razorpayOrderId: p.razorpayOrderId,
            paidAt: p.paidAt,
          },
        })),
      );
    }

    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items: entries.slice(0, limit).map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      total: entries.length,
      page,
      limit,
    };
  }

  async getSettings() {
    const [configs, packages, routing] = await Promise.all([
      this.prisma.platformConfig.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.coinPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          coinUnits: true,
          priceInr: true,
          isActive: true,
          isBestValue: true,
          isMostPopular: true,
        },
      }),
      this.prisma.callRoutingSettings.findUnique({ where: { id: 'default' } }),
    ]);

    const maintenance = configs.find((c) => c.key === 'platform.maintenance_mode');

    return {
      maintenanceMode: Boolean((maintenance?.value as { enabled?: boolean })?.enabled),
      configs: configs.map((c) => ({
        key: c.key,
        value: c.value,
        description: c.description,
        updatedAt: c.updatedAt,
      })),
      coinPackages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        coins: unitsToCoins(p.coinUnits),
        priceInr: decimalToNumber(p.priceInr),
        isActive: p.isActive,
        isBestValue: p.isBestValue,
        isMostPopular: p.isMostPopular,
      })),
      callRouting: routing
        ? {
            realHostTimeoutSeconds: routing.realHostTimeoutSeconds,
            aiFallbackEnabled: routing.aiFallbackEnabled,
            platformFeeNote: 'Configured via PLATFORM_FEE_PERCENT env',
          }
        : null,
    };
  }

  async exportReport(
    report: string,
    period: AnalyticsPeriod = '30d',
    from?: string,
    to?: string,
    format: 'csv' | 'excel' = 'csv',
  ) {
    const range = resolveAnalyticsRange(period, from, to);
    let csv = '';

    if (report === 'revenue' || report === 'daily' || report === 'monthly') {
      const dashboard = await this.analytics.getDashboard(period, from, to);
      csv = ['date,revenue_inr,recharge_inr,platform_fees_inr,calls,recharges']
        .concat(
          dashboard.trend.map(
            (r) =>
              `${r.date},${r.revenueInr},${r.rechargeInr},${r.platformFeesInr},${r.calls},${r.recharges}`,
          ),
        )
        .join('\n');
    } else if (report === 'calls') {
      const calls = await this.prisma.call.findMany({
        where: { createdAt: { gte: range.from, lte: range.to } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: {
          caller: { select: { displayName: true } },
          callee: { select: { displayName: true } },
        },
      });
      csv = ['date,call_id,status,host_type,caller,host,duration_sec,coins']
        .concat(
          calls.map(
            (c) =>
              `${c.createdAt.toISOString().slice(0, 10)},${c.id},${c.status},${c.hostCallType ?? ''},"${c.caller.displayName}","${c.callee.displayName}",${c.durationSeconds},${unitsToCoins(c.coinsChargedUnits)}`,
          ),
        )
        .join('\n');
    } else if (report === 'payments' || report === 'weekly') {
      const payments = await this.prisma.payment.findMany({
        where: { createdAt: { gte: range.from, lte: range.to } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: { user: { select: { displayName: true } } },
      });
      csv = ['date,payment_id,user,status,amount_inr,coins,paid_at']
        .concat(
          payments.map(
            (p) =>
              `${p.createdAt.toISOString().slice(0, 10)},${p.id},"${p.user.displayName}",${p.status},${decimalToNumber(p.totalInr)},${unitsToCoins(p.coinUnitsCredited)},${p.paidAt?.toISOString() ?? ''}`,
          ),
        )
        .join('\n');
    }

    if (format === 'excel') {
      return '\uFEFF' + csv;
    }
    return csv;
  }

  private async sumRevenue(from: Date, to: Date) {
    const [recharge, fees] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.paid, paidAt: { gte: from, lte: to } },
        _sum: { totalInr: true },
      }),
      this.prisma.hostEarning.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { platformFeeUnits: true },
      }),
    ]);
    return decimalToNumber(recharge._sum.totalInr) + unitsToInr(fees._sum.platformFeeUnits);
  }

  private async getHostBreakdown() {
    const [online, offline, busy, ai, real, managed] = await Promise.all([
      this.prisma.hostProfile.count({ where: { isOnline: true, isBusy: false } }),
      this.prisma.hostProfile.count({ where: { isOnline: false } }),
      this.prisma.hostProfile.count({ where: { isBusy: true } }),
      this.prisma.hostProfile.count({ where: { profileType: HostProfileType.AI_HOST } }),
      this.prisma.hostProfile.count({ where: { profileType: HostProfileType.REAL_HOST } }),
      this.prisma.hostProfile.count({ where: { profileType: HostProfileType.MANAGED_HOST } }),
    ]);

    return { online, offline, busy, ai, real, managed, total: ai + real + managed };
  }

  private async getTopHostsByType(type: HostProfileType, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        host_id: string;
        display_name: string | null;
        calls: bigint;
        revenue_units: bigint;
        rating: number | null;
      }>
    >`
      SELECT
        hp.user_id AS host_id,
        u.display_name,
        COALESCE(cs.calls, 0)::bigint AS calls,
        COALESCE(cs.revenue_units, 0)::bigint AS revenue_units,
        CASE WHEN hp.rating_count > 0 THEN hp.rating_sum::float / hp.rating_count ELSE NULL END AS rating
      FROM host_profiles hp
      JOIN users u ON u.id = hp.user_id
      LEFT JOIN (
        SELECT c.callee_id AS host_id,
               COUNT(*)::bigint AS calls,
               COALESCE(SUM(c.coins_charged_units), 0)::bigint AS revenue_units
        FROM calls c
        WHERE c.created_at >= ${from} AND c.created_at <= ${to}
        GROUP BY 1
      ) cs ON cs.host_id = hp.user_id
      WHERE hp.profile_type = ${type}::host_profile_type_enum
      ORDER BY revenue_units DESC, calls DESC
      LIMIT 10
    `;

    return rows.map((r) => ({
      hostId: r.host_id,
      name: r.display_name ?? 'Host',
      calls: Number(r.calls),
      revenueCoins: unitsToCoins(r.revenue_units),
      rating: r.rating,
    }));
  }

  private async getCoinUsageTrend(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; coins: bigint }>>`
      SELECT DATE(created_at) AS day, COALESCE(SUM(ABS(amount_units)), 0)::bigint AS coins
      FROM wallet_transactions
      WHERE created_at >= ${from}
        AND created_at <= ${to}
        AND type IN ('call_charge'::wallet_tx_type_enum, 'gift_send'::wallet_tx_type_enum)
      GROUP BY 1
      ORDER BY 1
    `;

    const byDay = new Map(rows.map((r) => [formatDateKey(new Date(r.day)), Number(r.coins)]));
    const trend: Array<{ date: string; value: number }> = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = formatDateKey(cursor);
      trend.push({ date: key, value: byDay.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return trend;
  }

  private async getFraudSummary() {
    const [multiAccount, rechargeAbuse, callSpam, failures, suspiciousIp, openFlags] =
      await Promise.all([
        this.prisma.fraudFlag.count({ where: { type: 'multi_account' } }),
        this.prisma.fraudFlag.count({ where: { type: 'wallet_fraud' } }),
        this.prisma.fraudFlag.count({ where: { type: 'call_fraud' } }),
        this.prisma.payment.count({
          where: {
            status: PaymentStatus.failed,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.fraudFlag.count({
          where: {
            type: 'geo_anomaly',
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.fraudFlag.count({
          where: { status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] } },
        }),
      ]);

    const recent = await this.prisma.fraudFlag.findMany({
      where: { status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, displayName: true } } },
    });

    return {
      multipleAccounts: multiAccount,
      rechargeAbuse: rechargeAbuse,
      callSpam: callSpam,
      repeatedFailures24h: failures,
      suspiciousIp7d: suspiciousIp,
      openFlags,
      recentAlerts: recent.map((f) => ({
        id: f.id,
        userId: f.userId,
        userName: f.user.displayName,
        type: f.type,
        riskScore: f.riskScore,
        reason: f.reason,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  private async getSystemAlerts() {
    const alerts: Array<{
      id: string;
      severity: 'info' | 'warning' | 'critical';
      type: string;
      message: string;
      createdAt: string;
    }> = [];

    const [failedPayments, offlineHosts, pendingWithdrawals, openTickets] = await Promise.all([
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.failed,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
      this.prisma.hostProfile.count({
        where: {
          profileType: HostProfileType.REAL_HOST,
          isOnline: true,
          OR: [{ hostHeartbeat: null }, { hostHeartbeat: { lastBeatAt: { lt: new Date(Date.now() - 60000) } } }],
        },
      }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.requested } }),
      this.prisma.grievanceTicket.count({ where: { status: GrievanceStatus.received } }),
    ]);

    if (failedPayments > 0) {
      alerts.push({
        id: 'payment-failed',
        severity: 'warning',
        type: 'payment_failed',
        message: `${failedPayments} payment(s) failed in the last hour`,
        createdAt: new Date().toISOString(),
      });
    }
    if (offlineHosts > 0) {
      alerts.push({
        id: 'host-offline',
        severity: 'info',
        type: 'host_offline',
        message: `${offlineHosts} host(s) marked online but missing heartbeat`,
        createdAt: new Date().toISOString(),
      });
    }
    if (pendingWithdrawals > 5) {
      alerts.push({
        id: 'withdrawals-queue',
        severity: 'warning',
        type: 'withdrawal_queue',
        message: `${pendingWithdrawals} withdrawals awaiting approval`,
        createdAt: new Date().toISOString(),
      });
    }
    if (openTickets > 0) {
      alerts.push({
        id: 'support-queue',
        severity: 'info',
        type: 'support_ticket',
        message: `${openTickets} open support ticket(s)`,
        createdAt: new Date().toISOString(),
      });
    }

    return alerts;
  }
}