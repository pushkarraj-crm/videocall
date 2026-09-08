import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FraudFlagStatus,
  Prisma,
  RiskLevel,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RiskActionsService } from './risk-actions.service';
import { UpdateRiskProfileDto } from './dto/update-risk-profile.dto';
import { RiskEventsQueryDto } from './dto/risk-events-query.dto';
import { RiskListQueryDto } from './dto/risk-list-query.dto';

@Injectable()
export class RiskAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actions: RiskActionsService,
  ) {}

  async getDashboard() {
    const [high, medium, critical, recentEvents, topTypes, criticalAlerts] = await Promise.all([
      this.prisma.riskUserProfile.count({ where: { riskLevel: RiskLevel.high } }),
      this.prisma.riskUserProfile.count({ where: { riskLevel: RiskLevel.medium } }),
      this.prisma.riskUserProfile.count({ where: { riskLevel: RiskLevel.critical } }),
      this.prisma.riskEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, displayName: true, email: true, phone: true } } },
      }),
      this.prisma.riskEvent.groupBy({
        by: ['eventType'],
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
        take: 6,
      }),
      this.prisma.fraudFlag.findMany({
        where: { status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] }, riskScore: { gte: 76 } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, displayName: true } } },
      }),
    ]);

    return {
      highRiskAccounts: high,
      mediumRiskAccounts: medium,
      criticalAccounts: critical,
      recentEvents: recentEvents.map((e) => this.serializeEvent(e)),
      topFraudTypes: topTypes.map((t) => ({ type: t.eventType, count: t._count })),
      criticalAlerts: criticalAlerts.map((f) => ({
        id: f.id,
        userId: f.userId,
        displayName: f.user.displayName,
        type: f.type,
        riskScore: f.riskScore,
        reason: f.reason,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  async listProfiles(query: RiskListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.RiskUserProfileWhereInput = {};
    if (query.riskLevel) where.riskLevel = query.riskLevel;
    if (query.minScore) where.aggregateScore = { gte: query.minScore };
    if (query.search) {
      where.user = {
        OR: [
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
        ],
      };
    }
    if (query.country) where.lastCountry = query.country;

    const [items, total] = await Promise.all([
      this.prisma.riskUserProfile.findMany({
        where,
        orderBy: [{ riskLevel: 'desc' }, { aggregateScore: 'desc' }],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              phone: true,
              status: true,
              abuseScore: true,
            },
          },
        },
      }),
      this.prisma.riskUserProfile.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        displayName: p.user.displayName,
        email: p.user.email,
        phone: p.user.phone,
        userStatus: p.user.status,
        aggregateScore: p.aggregateScore,
        riskLevel: p.riskLevel.toUpperCase(),
        freezeWithdrawals: p.freezeWithdrawals,
        freezeReferralRewards: p.freezeReferralRewards,
        freezeCouponRedemption: p.freezeCouponRedemption,
        requireReKyc: p.requireReKyc,
        lastCountry: p.lastCountry,
        lastIp: p.lastIp,
        lastEventAt: p.lastEventAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async getProfileDetail(userId: string) {
    const profile = await this.prisma.riskUserProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            status: true,
            deviceFingerprint: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, email: true, phone: true, status: true },
      });
      if (!user) throw new NotFoundException('User not found');
      return {
        user,
        profile: await this.actions.getRestrictions(userId),
        events: [],
        flags: [],
        timeline: [],
        devices: [],
      };
    }

    const [events, flags, audits, devices] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.fraudFlag.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.riskDecisionAudit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.deviceFingerprintRecord.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const timeline = [
      ...events.map((e) => ({
        kind: 'event' as const,
        at: e.createdAt.toISOString(),
        title: e.eventType,
        score: e.riskScore,
        level: e.riskLevel,
        reason: e.reason,
      })),
      ...flags.map((f) => ({
        kind: 'flag' as const,
        at: f.createdAt.toISOString(),
        title: f.type,
        score: f.riskScore,
        level: f.status,
        reason: f.reason,
      })),
      ...audits.map((a) => ({
        kind: 'audit' as const,
        at: a.createdAt.toISOString(),
        title: a.action,
        score: a.riskScore,
        level: null,
        reason: null,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      user: profile.user,
      profile: {
        aggregateScore: profile.aggregateScore,
        riskLevel: profile.riskLevel.toUpperCase(),
        freezeWithdrawals: profile.freezeWithdrawals,
        freezeReferralRewards: profile.freezeReferralRewards,
        freezeCouponRedemption: profile.freezeCouponRedemption,
        requireReKyc: profile.requireReKyc,
        lastCountry: profile.lastCountry,
        lastIp: profile.lastIp,
      },
      events: events.map((e) => this.serializeEvent(e)),
      flags: flags.map((f) => ({
        id: f.id,
        type: f.type,
        status: f.status.toUpperCase(),
        riskScore: f.riskScore,
        ruleId: f.ruleId,
        reason: f.reason,
        adminNote: f.adminNote,
        createdAt: f.createdAt.toISOString(),
      })),
      timeline,
      devices: devices.map((d) => ({
        fingerprintHash: d.fingerprintHash.slice(0, 8) + '…',
        platform: d.platform,
        os: d.os,
        lastCountry: d.lastCountry,
        lastIp: d.lastIp ? '***' : null,
        updatedAt: d.updatedAt.toISOString(),
      })),
    };
  }

  async updateProfile(userId: string, adminId: string, dto: UpdateRiskProfileDto) {
    const profile = await this.prisma.riskUserProfile.upsert({
      where: { userId },
      create: { userId, ...this.dtoToProfile(dto) },
      update: this.dtoToProfile(dto),
    });

    if (dto.adminNote) {
      await this.prisma.fraudFlag.updateMany({
        where: { userId, status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] } },
        data: { adminNote: dto.adminNote, status: FraudFlagStatus.reviewing },
      });
    }

    if (dto.markSafe) {
      await this.prisma.fraudFlag.updateMany({
        where: { userId, status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] } },
        data: {
          status: FraudFlagStatus.safe,
          resolvedAt: new Date(),
          resolvedById: adminId,
        },
      });
      await this.prisma.riskUserProfile.update({
        where: { userId },
        data: {
          aggregateScore: 0,
          riskLevel: RiskLevel.low,
          freezeWithdrawals: false,
          freezeReferralRewards: false,
          freezeCouponRedemption: false,
          requireReKyc: false,
        },
      });
    }

    if (dto.suspendAccount) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.suspended },
      });
    }

    if (dto.unsuspendAccount) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.active },
      });
    }

    await this.prisma.riskDecisionAudit.create({
      data: {
        userId,
        adminId,
        action: 'admin.risk_update',
        details: dto as unknown as Prisma.InputJsonValue,
      },
    });

    return { profile, updated: true };
  }

  async listEvents(query: RiskEventsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const where: Prisma.RiskEventWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.riskLevel) where.riskLevel = query.riskLevel;
    if (query.fingerprint) where.fingerprint = query.fingerprint;
    if (query.country) where.country = query.country;

    const [rows, total] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { displayName: true } } },
      }),
      this.prisma.riskEvent.count({ where }),
    ]);

    return {
      items: rows.map((e) => this.serializeEvent(e)),
      total,
      page,
      limit,
    };
  }

  async getAnalytics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      dailyAttempts,
      weeklyAttempts,
      monthlyAttempts,
      referralAbuse,
      couponAbuse,
      rechargeAbuse,
      withdrawalAbuse,
      topCountries,
      topDevices,
      topIps,
    ] = await Promise.all([
      this.prisma.riskEvent.count({ where: { createdAt: { gte: today } } }),
      this.prisma.riskEvent.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.riskEvent.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.fraudFlag.count({ where: { type: 'referral_fraud', createdAt: { gte: monthAgo } } }),
      this.prisma.fraudFlag.count({ where: { type: 'promo_fraud', createdAt: { gte: monthAgo } } }),
      this.prisma.fraudFlag.count({ where: { type: 'wallet_fraud', createdAt: { gte: monthAgo } } }),
      this.prisma.fraudFlag.count({ where: { type: 'withdrawal_fraud', createdAt: { gte: monthAgo } } }),
      this.prisma.riskEvent.groupBy({
        by: ['country'],
        where: { country: { not: null }, createdAt: { gte: monthAgo } },
        _count: true,
        orderBy: { _count: { country: 'desc' } },
        take: 5,
      }),
      this.prisma.riskEvent.groupBy({
        by: ['fingerprint'],
        where: { fingerprint: { not: null }, createdAt: { gte: monthAgo } },
        _count: true,
        orderBy: { _count: { fingerprint: 'desc' } },
        take: 5,
      }),
      this.prisma.riskEvent.groupBy({
        by: ['ipAddress'],
        where: { ipAddress: { not: null }, createdAt: { gte: monthAgo } },
        _count: true,
        orderBy: { _count: { ipAddress: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      dailyFraudAttempts: dailyAttempts,
      weeklyFraudAttempts: weeklyAttempts,
      monthlyFraudAttempts: monthlyAttempts,
      referralAbuse,
      couponAbuse,
      rechargeAbuse,
      withdrawalAbuse,
      topRiskCountries: topCountries.map((c) => ({
        country: c.country,
        count: c._count,
      })),
      topRiskDevices: topDevices.map((d) => ({
        fingerprint: d.fingerprint ? `${d.fingerprint.slice(0, 8)}…` : null,
        count: d._count,
      })),
      topRiskIps: topIps.map((i) => ({
        ip: i.ipAddress ? '***' : null,
        count: i._count,
      })),
    };
  }

  private dtoToProfile(dto: UpdateRiskProfileDto) {
    return {
      ...(dto.freezeWithdrawals !== undefined ? { freezeWithdrawals: dto.freezeWithdrawals } : {}),
      ...(dto.freezeReferralRewards !== undefined ? { freezeReferralRewards: dto.freezeReferralRewards } : {}),
      ...(dto.freezeCouponRedemption !== undefined ? { freezeCouponRedemption: dto.freezeCouponRedemption } : {}),
      ...(dto.requireReKyc !== undefined ? { requireReKyc: dto.requireReKyc } : {}),
    };
  }

  private serializeEvent(e: {
    id: string;
    userId: string;
    eventType: string;
    riskScore: number;
    riskLevel: RiskLevel;
    reason: string;
    ruleId: string | null;
    country: string | null;
    fingerprint: string | null;
    createdAt: Date;
    user?: { displayName: string };
  }) {
    return {
      id: e.id,
      userId: e.userId,
      displayName: e.user?.displayName,
      eventType: e.eventType,
      riskScore: e.riskScore,
      riskLevel: e.riskLevel.toUpperCase(),
      reason: e.reason,
      ruleId: e.ruleId,
      country: e.country,
      fingerprint: e.fingerprint ? `${e.fingerprint.slice(0, 8)}…` : null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}