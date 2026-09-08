import { Injectable } from '@nestjs/common';
import {
  CallStatus,
  HostProfileType,
  KycVerificationStatus,
  PaymentStatus,
  Prisma,
  WithdrawalStatus,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import {
  AnalyticsDateRange,
  AnalyticsPeriod,
  buildDailyTrend,
  calcAvgDurationSeconds,
  calcPlatformProfit,
  calcRevenuePerCall,
  decimalToNumber,
  endOfDay,
  formatDateKey,
  resolveAnalyticsRange,
  startOfDay,
  unitsToInr,
} from '../../common/utils/analytics-period';
import { PrismaService } from '../../database/prisma.service';

type TrendRow = {
  date: string;
  revenueInr: number;
  rechargeInr: number;
  platformFeesInr: number;
  calls: number;
  recharges: number;
};

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(period: AnalyticsPeriod = '30d', from?: string, to?: string) {
    const range = resolveAnalyticsRange(period, from, to);
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfDay(now);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueTotal,
      hostWithdrawnTotal,
      rechargeTotals,
      userMetrics,
      callSnapshots,
      callPeriod,
      rechargePeriod,
      revenuePeriod,
      withdrawalMetrics,
      trendRows,
      topHosts,
      topUsers,
      virtualHostMetrics,
    ] = await Promise.all([
      this.sumRevenueForRange(todayStart, endOfDay(now)),
      this.sumRevenueForRange(weekStart, endOfDay(now)),
      this.sumRevenueForRange(monthStart, endOfDay(now)),
      this.sumRevenueForRange(new Date(0), endOfDay(now)),
      this.sumHostWithdrawals(),
      this.sumRecharges(new Date(0), endOfDay(now)),
      this.getUserMetrics(todayStart),
      this.getCallSnapshots(todayStart, weekStart, monthStart),
      this.getCallMetricsForRange(range.from, range.to),
      this.getRechargeMetricsForRange(range.from, range.to),
      this.sumRevenueForRange(range.from, range.to),
      this.getWithdrawalMetrics(),
      this.getTrend(range.from, range.to),
      this.getTopHosts(range.from, range.to),
      this.getTopUsers(range.from, range.to),
      this.getVirtualHostMetrics(range.from, range.to),
    ]);

    const platformProfitInr = calcPlatformProfit(
      revenueTotal.totalInr,
      hostWithdrawnTotal,
    );

    return {
      period: {
        key: range.period,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      revenue: {
        todayInr: revenueToday.totalInr,
        weekInr: revenueWeek.totalInr,
        monthInr: revenueMonth.totalInr,
        totalInr: revenueTotal.totalInr,
        totalWithdrawalsInr: hostWithdrawnTotal,
        platformProfitInr,
        totalRechargesInr: rechargeTotals.amountInr,
        periodRechargeInr: revenuePeriod.rechargeInr,
        periodPlatformFeesInr: revenuePeriod.platformFeesInr,
        periodTotalInr: revenuePeriod.totalInr,
      },
      users: userMetrics,
      calls: {
        ...callSnapshots,
        ...callPeriod,
      },
      recharges: rechargePeriod,
      withdrawals: withdrawalMetrics,
      trend: trendRows,
      topHosts,
      topUsers,
      virtualHosts: virtualHostMetrics,
    };
  }

  private async getVirtualHostMetrics(from: Date, to: Date) {
    const [realCalls, virtualSessions, virtualGiftRevenue, repeatUsers] = await Promise.all([
      this.prisma.call.count({
        where: {
          status: CallStatus.ended,
          endedAt: { gte: from, lte: to },
          callee: { hostProfile: { profileType: HostProfileType.REAL_HOST } },
        },
      }),
      this.prisma.virtualHostSession.aggregate({
        where: { startedAt: { gte: from, lte: to } },
        _count: { id: true },
        _avg: { durationSeconds: true },
        _sum: { coinsSpentUnits: true, giftsReceivedCount: true },
      }),
      this.prisma.callGift.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          call: { virtualHostSession: { isNot: null } },
        },
        _sum: { coinUnits: true },
      }),
      this.prisma.virtualHostSession.groupBy({
        by: ['userId'],
        where: { startedAt: { gte: from, lte: to } },
        _count: { id: true },
      }),
    ]);

    const repeatUserCount = repeatUsers.filter((row) => row._count.id > 1).length;
    const uniqueUsers = repeatUsers.length;

    return {
      realHostCalls: realCalls,
      virtualHostCalls: virtualSessions._count.id,
      averageDurationSeconds: Math.round(virtualSessions._avg.durationSeconds ?? 0),
      callRevenueCoins: unitsToCoins(virtualSessions._sum.coinsSpentUnits ?? 0n),
      giftRevenueCoins: unitsToCoins(virtualGiftRevenue._sum.coinUnits ?? 0n),
      repeatUsers: repeatUserCount,
      retentionRate:
        uniqueUsers > 0 ? Math.round((repeatUserCount / uniqueUsers) * 100) : 0,
    };
  }

  async exportCsv(
    type: 'revenue' | 'hosts' | 'withdrawals',
    period: AnalyticsPeriod = '30d',
    from?: string,
    to?: string,
  ): Promise<string> {
    const range = resolveAnalyticsRange(period, from, to);
    const dashboard = await this.getDashboard(period, from, to);

    if (type === 'revenue') {
      const header = 'date,revenue_inr,recharge_inr,platform_fees_inr,calls,recharges';
      const lines = dashboard.trend.map(
        (row) =>
          `${row.date},${row.revenueInr},${row.rechargeInr},${row.platformFeesInr},${row.calls},${row.recharges}`,
      );
      return [header, ...lines].join('\n');
    }

    if (type === 'hosts') {
      const header = 'host_name,calls,minutes,revenue_inr,withdrawn_inr';
      const lines = dashboard.topHosts.map(
        (row) =>
          `"${row.name}",${row.calls},${row.minutes},${row.revenueInr},${row.withdrawnInr}`,
      );
      return [header, ...lines].join('\n');
    }

    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        host: { select: { displayName: true } },
      },
    });

    const header = 'date,host,amount_inr,net_inr,status';
    const lines = withdrawals.map(
      (w) =>
        `${w.createdAt.toISOString().slice(0, 10)},"${w.host.displayName ?? 'Host'}",${decimalToNumber(w.amountInr)},${decimalToNumber(w.netInr)},${w.status}`,
    );
    return [header, ...lines].join('\n');
  }

  private async sumRevenueForRange(from: Date, to: Date) {
    const [recharge, platformFees] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.paid,
          paidAt: { gte: from, lte: to },
        },
        _sum: { totalInr: true },
      }),
      this.sumPlatformFees(from, to),
    ]);

    const rechargeInr = decimalToNumber(recharge._sum.totalInr);
    return {
      rechargeInr,
      platformFeesInr: platformFees,
      totalInr: rechargeInr + platformFees,
    };
  }

  private async sumPlatformFees(from: Date, to: Date): Promise<number> {
    const [callFees, giftFees] = await Promise.all([
      this.prisma.hostEarning.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { platformFeeUnits: true },
      }),
      this.prisma.callGift.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { platformFeeUnits: true },
      }),
    ]);

    return (
      unitsToInr(callFees._sum.platformFeeUnits) +
      unitsToInr(giftFees._sum.platformFeeUnits)
    );
  }

  private async sumHostWithdrawals(): Promise<number> {
    const result = await this.prisma.withdrawal.aggregate({
      where: { status: WithdrawalStatus.completed },
      _sum: { netInr: true },
    });
    return decimalToNumber(result._sum.netInr);
  }

  private async sumRecharges(from: Date, to: Date) {
    const result = await this.prisma.payment.aggregate({
      where: {
        status: PaymentStatus.paid,
        paidAt: { gte: from, lte: to },
      },
      _count: true,
      _sum: { totalInr: true },
    });

    const amountInr = decimalToNumber(result._sum.totalInr);
    const count = result._count;
    return {
      count,
      amountInr,
      avgInr: count > 0 ? Math.round((amountInr / count) * 100) / 100 : 0,
    };
  }

  private async getUserMetrics(todayStart: Date) {
    const [
      totalUsers,
      newUsersToday,
      totalHosts,
      verifiedHosts,
      onlineHosts,
      busyHosts,
      activeUsersToday,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: todayStart } },
      }),
      this.prisma.hostProfile.count(),
      this.prisma.hostKyc.findMany({
        where: { verificationStatus: KycVerificationStatus.verified },
        distinct: ['userId'],
        select: { userId: true },
      }).then((rows) => rows.length),
      this.prisma.hostProfile.count({ where: { isOnline: true } }),
      this.prisma.hostProfile.count({ where: { isBusy: true } }),
      this.countActiveUsersToday(todayStart),
    ]);

    return {
      totalUsers,
      activeUsersToday,
      newUsersToday,
      totalHosts,
      verifiedHosts,
      onlineHosts,
      busyHosts,
    };
  }

  private async countActiveUsersToday(todayStart: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT user_id)::bigint AS count
      FROM (
        SELECT caller_id AS user_id FROM calls WHERE created_at >= ${todayStart}
        UNION
        SELECT callee_id AS user_id FROM calls WHERE created_at >= ${todayStart}
        UNION
        SELECT user_id FROM payments
          WHERE status = 'paid'::payment_status_enum AND paid_at >= ${todayStart}
      ) active_users
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private async getCallSnapshots(todayStart: Date, weekStart: Date, monthStart: Date) {
    const [today, week, month, lifetime] = await Promise.all([
      this.countCalls(todayStart, endOfDay(new Date())),
      this.countCalls(weekStart, endOfDay(new Date())),
      this.countCalls(monthStart, endOfDay(new Date())),
      this.countCalls(new Date(0), endOfDay(new Date())),
    ]);

    return {
      today: today.count,
      week: week.count,
      month: month.count,
      total: lifetime.count,
      totalMinutes: lifetime.totalMinutes,
    };
  }

  private async getCallMetricsForRange(from: Date, to: Date) {
    const endedCalls = await this.prisma.call.aggregate({
      where: {
        createdAt: { gte: from, lte: to },
        status: CallStatus.ended,
      },
      _count: true,
      _sum: { durationSeconds: true, coinsChargedUnits: true },
    });

    const periodCount = endedCalls._count;
    const totalSeconds = Number(endedCalls._sum.durationSeconds ?? 0);
    const platformFees = await this.sumPlatformFees(from, to);

    return {
      periodCount,
      totalMinutes: Math.round(totalSeconds / 60),
      avgDurationSeconds: calcAvgDurationSeconds(totalSeconds, periodCount),
      revenuePerCallInr: calcRevenuePerCall(platformFees, periodCount),
    };
  }

  private async countCalls(from: Date, to: Date) {
    const result = await this.prisma.call.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _count: true,
      _sum: { durationSeconds: true },
    });

    return {
      count: result._count,
      totalMinutes: Math.round(Number(result._sum.durationSeconds ?? 0) / 60),
    };
  }

  private async getRechargeMetricsForRange(from: Date, to: Date) {
    const [summary, topPackageRows] = await Promise.all([
      this.sumRecharges(from, to),
      this.prisma.payment.groupBy({
        by: ['packageId'],
        where: {
          status: PaymentStatus.paid,
          paidAt: { gte: from, lte: to },
          packageId: { not: null },
        },
        _count: true,
        _sum: { totalInr: true },
        orderBy: { _sum: { totalInr: 'desc' } },
        take: 1,
      }),
    ]);

    let topPackage: {
      id: string;
      name: string;
      count: number;
      amountInr: number;
    } | null = null;

    if (topPackageRows[0]?.packageId) {
      const pkg = await this.prisma.coinPackage.findUnique({
        where: { id: topPackageRows[0].packageId! },
        select: { id: true, name: true },
      });
      if (pkg) {
        topPackage = {
          id: pkg.id,
          name: pkg.name,
          count: topPackageRows[0]._count,
          amountInr: decimalToNumber(topPackageRows[0]._sum.totalInr),
        };
      }
    }

    return {
      count: summary.count,
      amountInr: summary.amountInr,
      avgInr: summary.avgInr,
      topPackage,
    };
  }

  private async getWithdrawalMetrics() {
    const [pending, approved, paid, rejected, totalWithdrawn] = await Promise.all([
      this.prisma.withdrawal.count({
        where: {
          status: {
            in: [WithdrawalStatus.requested, WithdrawalStatus.processing],
          },
        },
      }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.approved } }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.completed } }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.rejected } }),
      this.prisma.withdrawal.aggregate({
        where: { status: WithdrawalStatus.completed },
        _sum: { netInr: true },
      }),
    ]);

    return {
      pending,
      approved,
      paid,
      rejected,
      totalWithdrawnInr: decimalToNumber(totalWithdrawn._sum.netInr),
    };
  }

  private async getTrend(from: Date, to: Date): Promise<TrendRow[]> {
    const [rechargeRows, callRows, feeRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; recharge_inr: Prisma.Decimal; recharges: bigint }>>`
        SELECT DATE(paid_at) AS day,
               COALESCE(SUM(total_inr), 0) AS recharge_inr,
               COUNT(*)::bigint AS recharges
        FROM payments
        WHERE status = 'paid'::payment_status_enum
          AND paid_at >= ${from}
          AND paid_at <= ${to}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ day: Date; calls: bigint }>>`
        SELECT DATE(created_at) AS day, COUNT(*)::bigint AS calls
        FROM calls
        WHERE created_at >= ${from}
          AND created_at <= ${to}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ day: Date; fee_units: bigint }>>`
        SELECT day, COALESCE(SUM(fee_units), 0)::bigint AS fee_units
        FROM (
          SELECT DATE(created_at) AS day, platform_fee_units AS fee_units
          FROM host_earnings
          WHERE created_at >= ${from} AND created_at <= ${to}
          UNION ALL
          SELECT DATE(created_at) AS day, platform_fee_units AS fee_units
          FROM call_gifts
          WHERE created_at >= ${from} AND created_at <= ${to}
        ) fees
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const rechargeByDay = new Map(
      rechargeRows.map((row) => [
        formatDateKey(new Date(row.day)),
        {
          rechargeInr: decimalToNumber(row.recharge_inr),
          recharges: Number(row.recharges),
        },
      ]),
    );
    const callsByDay = new Map(
      callRows.map((row) => [formatDateKey(new Date(row.day)), Number(row.calls)]),
    );
    const feesByDay = new Map(
      feeRows.map((row) => [formatDateKey(new Date(row.day)), unitsToInr(row.fee_units)]),
    );

    const merged = buildDailyTrend(
      from,
      to,
      [] as TrendRow[],
      {
        revenueInr: 0,
        rechargeInr: 0,
        platformFeesInr: 0,
        calls: 0,
        recharges: 0,
      },
    ).map((row) => {
      const recharge = rechargeByDay.get(row.date);
      const platformFeesInr = feesByDay.get(row.date) ?? 0;
      const rechargeInr = recharge?.rechargeInr ?? 0;
      return {
        date: row.date,
        rechargeInr,
        platformFeesInr,
        revenueInr: rechargeInr + platformFeesInr,
        calls: callsByDay.get(row.date) ?? 0,
        recharges: recharge?.recharges ?? 0,
      };
    });

    return merged;
  }

  private async getTopHosts(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        host_id: string;
        display_name: string | null;
        calls: bigint;
        minutes: bigint;
        revenue_units: bigint;
        withdrawn_inr: Prisma.Decimal | null;
      }>
    >`
      SELECT
        hp.user_id AS host_id,
        u.display_name,
        COALESCE(call_stats.calls, 0)::bigint AS calls,
        COALESCE(call_stats.minutes, 0)::bigint AS minutes,
        COALESCE(fee_stats.revenue_units, 0)::bigint AS revenue_units,
        COALESCE(withdrawn.withdrawn_inr, 0) AS withdrawn_inr
      FROM host_profiles hp
      JOIN users u ON u.id = hp.user_id
      LEFT JOIN (
        SELECT callee_id AS host_id,
               COUNT(*)::bigint AS calls,
               (COALESCE(SUM(duration_seconds), 0) / 60)::bigint AS minutes
        FROM calls
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY 1
      ) call_stats ON call_stats.host_id = hp.user_id
      LEFT JOIN (
        SELECT host_id,
               SUM(platform_fee_units)::bigint AS revenue_units
        FROM host_earnings
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY 1
      ) fee_stats ON fee_stats.host_id = hp.user_id
      LEFT JOIN (
        SELECT host_id, SUM(net_inr) AS withdrawn_inr
        FROM withdrawals
        WHERE status = 'completed'::withdrawal_status_enum
          AND created_at >= ${from} AND created_at <= ${to}
        GROUP BY 1
      ) withdrawn ON withdrawn.host_id = hp.user_id
      ORDER BY revenue_units DESC, calls DESC
      LIMIT 10
    `;

    return rows.map((row) => ({
      hostId: row.host_id,
      name: row.display_name ?? 'Host',
      calls: Number(row.calls),
      minutes: Number(row.minutes),
      revenueInr: unitsToInr(row.revenue_units),
      withdrawnInr: decimalToNumber(row.withdrawn_inr),
    }));
  }

  private async getTopUsers(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        display_name: string | null;
        recharge_inr: Prisma.Decimal | null;
        calls: bigint;
        minutes: bigint;
      }>
    >`
      SELECT
        u.id AS user_id,
        u.display_name,
        recharge.recharge_inr,
        COALESCE(call_stats.calls, 0)::bigint AS calls,
        COALESCE(call_stats.minutes, 0)::bigint AS minutes
      FROM users u
      JOIN (
        SELECT user_id, SUM(total_inr) AS recharge_inr
        FROM payments
        WHERE status = 'paid'::payment_status_enum
          AND paid_at >= ${from} AND paid_at <= ${to}
        GROUP BY 1
        ORDER BY SUM(total_inr) DESC
        LIMIT 10
      ) recharge ON recharge.user_id = u.id
      LEFT JOIN (
        SELECT caller_id AS user_id,
               COUNT(*)::bigint AS calls,
               (COALESCE(SUM(duration_seconds), 0) / 60)::bigint AS minutes
        FROM calls
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY 1
      ) call_stats ON call_stats.user_id = u.id
      ORDER BY recharge.recharge_inr DESC
    `;

    return rows.map((row) => ({
      userId: row.user_id,
      name: row.display_name ?? 'User',
      rechargeInr: decimalToNumber(row.recharge_inr),
      calls: Number(row.calls),
      minutes: Number(row.minutes),
    }));
  }
}