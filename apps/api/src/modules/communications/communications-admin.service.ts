import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CommunicationAudience,
  CommunicationCampaignStatus,
  CommunicationChannel,
  CommunicationEventType,
  CommunicationLogStatus,
  KycVerificationStatus,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminEmailDto } from './dto/admin-email.dto';
import { AdminSmsDto } from './dto/admin-sms.dto';
import { CommunicationsDispatcherService } from './communications-dispatcher.service';
import { maskRecipient } from './utils/mask-sensitive';

@Injectable()
export class CommunicationsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: CommunicationsDispatcherService,
  ) {}

  async list(page = 1, limit = 20) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.communicationCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.communicationCampaign.count(),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        channel: c.channel,
        title: c.title,
        audience: c.audience,
        status: c.status.toUpperCase(),
        scheduledAt: c.scheduledAt?.toISOString() ?? null,
        sentAt: c.sentAt?.toISOString() ?? null,
        recipientCount: c.recipientCount,
        deliveredCount: c.deliveredCount,
        openedCount: c.openedCount,
        clickedCount: c.clickedCount,
        failedCount: c.failedCount,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      limit: take,
    };
  }

  async getAnalytics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const emailWhere = { channel: CommunicationChannel.email };
    const smsWhere = { channel: CommunicationChannel.sms };

    const [
      totalEmails,
      emailDelivered,
      emailOpened,
      emailClicked,
      emailBounced,
      totalSms,
      smsDelivered,
      smsFailed,
      dailyEmails,
      weeklyEmails,
      monthlyEmails,
      dailySms,
      weeklySms,
      monthlySms,
    ] = await Promise.all([
      this.prisma.communicationLog.count({ where: emailWhere }),
      this.prisma.communicationLog.count({
        where: { ...emailWhere, status: { in: [CommunicationLogStatus.sent, CommunicationLogStatus.delivered] } },
      }),
      this.prisma.communicationLog.count({ where: { ...emailWhere, openedAt: { not: null } } }),
      this.prisma.communicationLog.count({ where: { ...emailWhere, clickedAt: { not: null } } }),
      this.prisma.communicationLog.count({ where: { ...emailWhere, status: CommunicationLogStatus.bounced } }),
      this.prisma.communicationLog.count({ where: smsWhere }),
      this.prisma.communicationLog.count({
        where: { ...smsWhere, status: { in: [CommunicationLogStatus.sent, CommunicationLogStatus.delivered] } },
      }),
      this.prisma.communicationLog.count({ where: { ...smsWhere, status: CommunicationLogStatus.failed } }),
      this.prisma.communicationLog.count({ where: { ...emailWhere, createdAt: { gte: todayStart } } }),
      this.prisma.communicationLog.count({ where: { ...emailWhere, createdAt: { gte: weekStart } } }),
      this.prisma.communicationLog.count({ where: { ...emailWhere, createdAt: { gte: monthStart } } }),
      this.prisma.communicationLog.count({ where: { ...smsWhere, createdAt: { gte: todayStart } } }),
      this.prisma.communicationLog.count({ where: { ...smsWhere, createdAt: { gte: weekStart } } }),
      this.prisma.communicationLog.count({ where: { ...smsWhere, createdAt: { gte: monthStart } } }),
    ]);

    const openRate = totalEmails > 0 ? Math.round((emailOpened / totalEmails) * 100) : 0;
    const clickRate = totalEmails > 0 ? Math.round((emailClicked / totalEmails) * 100) : 0;
    const bounceRate = totalEmails > 0 ? Math.round((emailBounced / totalEmails) * 100) : 0;
    const deliveryRate = totalEmails > 0 ? Math.round((emailDelivered / totalEmails) * 100) : 0;
    const smsDeliveryRate = totalSms > 0 ? Math.round((smsDelivered / totalSms) * 100) : 0;

    return {
      totalEmails,
      deliveryRate,
      openRate,
      clickRate,
      bounceRate,
      smsDeliveryRate,
      totalSms,
      smsDelivered,
      smsFailed,
      dailyEmails,
      weeklyEmails,
      monthlyEmails,
      dailySms,
      weeklySms,
      monthlySms,
    };
  }

  async getLogs(page = 1, limit = 20, channel?: CommunicationChannel, status?: CommunicationLogStatus) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where: Prisma.CommunicationLogWhereInput = {};
    if (channel) where.channel = channel;
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      this.prisma.communicationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.communicationLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        eventType: r.eventType,
        template: r.template,
        provider: r.provider,
        recipient: maskRecipient(r.channel, r.recipient),
        subject: r.subject,
        status: r.status.toUpperCase(),
        providerId: r.providerId,
        retryCount: r.retryCount,
        deliveredAt: r.deliveredAt?.toISOString() ?? null,
        openedAt: r.openedAt?.toISOString() ?? null,
        clickedAt: r.clickedAt?.toISOString() ?? null,
        failedAt: r.failedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit: take,
    };
  }

  async composeEmail(adminId: string, dto: AdminEmailDto) {
    if (dto.preview) {
      return {
        preview: true,
        subject: dto.subject,
        body: dto.body,
        htmlBody: dto.htmlBody ?? dto.body,
        audience: dto.audience,
      };
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isDraft = dto.draft === true;
    const isScheduled = scheduledAt && scheduledAt > new Date();

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: 'admin',
        action: 'communication.compose_email',
        entityType: 'communication_campaign',
        newValue: { title: dto.title, audience: dto.audience, draft: isDraft } as unknown as Prisma.InputJsonValue,
      },
    });

    const campaign = await this.prisma.communicationCampaign.create({
      data: {
        adminId,
        channel: CommunicationChannel.email,
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        htmlBody: dto.htmlBody,
        audience: dto.audience,
        targetUserId: dto.targetUserId,
        status: isDraft
          ? CommunicationCampaignStatus.draft
          : isScheduled
            ? CommunicationCampaignStatus.scheduled
            : CommunicationCampaignStatus.sending,
        scheduledAt: isScheduled ? scheduledAt : null,
        sentAt: !isDraft && !isScheduled ? new Date() : null,
      },
    });

    if (!isDraft && !isScheduled) {
      const sent = await this.dispatchCampaign(campaign.id);
      return { campaignId: campaign.id, status: 'SENT', queued: sent.queued };
    }

    return {
      campaignId: campaign.id,
      status: isDraft ? 'DRAFT' : 'SCHEDULED',
      queued: 0,
    };
  }

  async composeSms(adminId: string, dto: AdminSmsDto) {
    if (dto.preview) {
      return { preview: true, body: dto.body, audience: dto.audience };
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isDraft = dto.draft === true;
    const isScheduled = scheduledAt && scheduledAt > new Date();

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: 'admin',
        action: 'communication.compose_sms',
        entityType: 'communication_campaign',
        newValue: { title: dto.title, audience: dto.audience, draft: isDraft } as unknown as Prisma.InputJsonValue,
      },
    });

    const campaign = await this.prisma.communicationCampaign.create({
      data: {
        adminId,
        channel: CommunicationChannel.sms,
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: dto.audience,
        targetUserId: dto.targetUserId,
        status: isDraft
          ? CommunicationCampaignStatus.draft
          : isScheduled
            ? CommunicationCampaignStatus.scheduled
            : CommunicationCampaignStatus.sending,
        scheduledAt: isScheduled ? scheduledAt : null,
        sentAt: !isDraft && !isScheduled ? new Date() : null,
      },
    });

    if (!isDraft && !isScheduled) {
      const sent = await this.dispatchCampaign(campaign.id);
      return { campaignId: campaign.id, status: 'SENT', queued: sent.queued };
    }

    return {
      campaignId: campaign.id,
      status: isDraft ? 'DRAFT' : 'SCHEDULED',
      queued: 0,
    };
  }

  async processScheduledCampaigns() {
    const due = await this.prisma.communicationCampaign.findMany({
      where: {
        status: CommunicationCampaignStatus.scheduled,
        scheduledAt: { lte: new Date() },
      },
      take: 5,
    });

    let sent = 0;
    for (const c of due) {
      await this.prisma.communicationCampaign.update({
        where: { id: c.id },
        data: { status: CommunicationCampaignStatus.sending, sentAt: new Date() },
      });
      await this.dispatchCampaign(c.id);
      sent++;
    }
    return { sent };
  }

  async refreshCampaignMetrics() {
    const campaigns = await this.prisma.communicationCampaign.findMany({
      where: { status: { in: [CommunicationCampaignStatus.sent, CommunicationCampaignStatus.sending] } },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    for (const c of campaigns) {
      const logs = await this.prisma.communicationLog.groupBy({
        by: ['status'],
        where: { campaignId: c.id },
        _count: true,
      });

      const delivered = logs
        .filter((l) => l.status === CommunicationLogStatus.sent || l.status === CommunicationLogStatus.delivered)
        .reduce((s, l) => s + l._count, 0);
      const failed = logs.find((l) => l.status === CommunicationLogStatus.failed)?._count ?? 0;
      const bounced = logs.find((l) => l.status === CommunicationLogStatus.bounced)?._count ?? 0;

      const [opened, clicked, recipientCount] = await Promise.all([
        this.prisma.communicationLog.count({ where: { campaignId: c.id, openedAt: { not: null } } }),
        this.prisma.communicationLog.count({ where: { campaignId: c.id, clickedAt: { not: null } } }),
        this.prisma.communicationLog.count({ where: { campaignId: c.id } }),
      ]);

      await this.prisma.communicationCampaign.update({
        where: { id: c.id },
        data: {
          recipientCount: Math.max(c.recipientCount, recipientCount),
          deliveredCount: delivered,
          openedCount: opened,
          clickedCount: clicked,
          failedCount: failed,
          bouncedCount: bounced,
          status:
            c.status === CommunicationCampaignStatus.sending && recipientCount > 0
              ? CommunicationCampaignStatus.sent
              : c.status,
        },
      });
    }
  }

  private async dispatchCampaign(campaignId: string) {
    const campaign = await this.prisma.communicationCampaign.findUniqueOrThrow({
      where: { id: campaignId },
    });

    const recipients = await this.resolveAudience(campaign.audience, campaign.targetUserId);
    let queued = 0;

    for (const user of recipients) {
      const contact =
        campaign.channel === CommunicationChannel.email ? user.email : user.phone;
      if (!contact) continue;

      const eventType = CommunicationEventType.admin_custom;
      const result =
        campaign.channel === CommunicationChannel.email
          ? await this.dispatcher.sendEmail({
              userId: user.id,
              to: contact,
              eventType,
              subject: campaign.subject ?? campaign.title,
              body: campaign.body,
              htmlBody: campaign.htmlBody ?? undefined,
              referenceId: campaignId,
              referenceType: 'CAMPAIGN',
              idempotencyKey: `campaign:${campaignId}:${user.id}`,
            })
          : await this.dispatcher.sendSms({
              userId: user.id,
              to: contact,
              eventType,
              body: campaign.body,
              referenceId: campaignId,
              referenceType: 'CAMPAIGN',
              idempotencyKey: `campaign:${campaignId}:${user.id}`,
            });

      if (result.queued) queued++;
    }

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        recipientCount: queued,
        status: CommunicationCampaignStatus.sent,
      },
    });

    return { queued };
  }

  private async resolveAudience(audience: CommunicationAudience, targetUserId?: string | null) {
    if (audience === CommunicationAudience.single_user) {
      if (!targetUserId) throw new BadRequestException('targetUserId required for single_user');
      const user = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, phone: true, displayName: true },
      });
      return user ? [user] : [];
    }

    const baseWhere: Prisma.UserWhereInput = { status: 'active', deletedAt: null };

    switch (audience) {
      case CommunicationAudience.hosts:
        return this.prisma.user.findMany({
          where: {
            ...baseWhere,
            roles: { some: { role: Role.host, revokedAt: null } },
          },
          select: { id: true, email: true, phone: true, displayName: true },
          take: 500,
        });
      case CommunicationAudience.users:
        return this.prisma.user.findMany({
          where: {
            ...baseWhere,
            roles: { none: { role: Role.host, revokedAt: null } },
          },
          select: { id: true, email: true, phone: true, displayName: true },
          take: 500,
        });
      case CommunicationAudience.verified_hosts:
        return this.prisma.user.findMany({
          where: {
            ...baseWhere,
            hostKycRecords: { some: { verificationStatus: KycVerificationStatus.verified } },
          },
          select: { id: true, email: true, phone: true, displayName: true },
          take: 500,
        });
      case CommunicationAudience.vip_users:
        return this.prisma.user.findMany({
          where: {
            ...baseWhere,
            payments: { some: { status: PaymentStatus.paid, totalInr: { gte: 5000 } } },
          },
          select: { id: true, email: true, phone: true, displayName: true },
          take: 500,
        });
      case CommunicationAudience.all_users:
      default:
        return this.prisma.user.findMany({
          where: baseWhere,
          select: { id: true, email: true, phone: true, displayName: true },
          take: 500,
        });
    }
  }
}