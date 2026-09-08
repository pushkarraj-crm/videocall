import { Injectable } from '@nestjs/common';
import { NotificationBroadcastStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Injectable()
export class NotificationsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async list(page = 1, limit = 20) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;
    const [rows, total] = await Promise.all([
      this.prisma.notificationBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notificationBroadcast.count(),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        target: r.target,
        priority: r.priority,
        status: r.status.toUpperCase(),
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
        sentAt: r.sentAt?.toISOString() ?? null,
        recipientCount: r.recipientCount,
        readCount: r.readCount,
        clickCount: r.clickCount,
        createdAt: r.createdAt.toISOString(),
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

    const [sent, read, clicked, daily, weekly, monthly, topTypes] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { isRead: true } }),
      this.prisma.notification.count({ where: { clicked: true } }),
      this.prisma.notification.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.notification.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.notification.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        _count: true,
        orderBy: { _count: { type: 'desc' } },
        take: 8,
      }),
    ]);

    const unread = sent - read;
    const ctr = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
    const readRate = sent > 0 ? Math.round((read / sent) * 100) : 0;

    return {
      notificationsSent: sent,
      delivered: sent,
      read,
      clicked,
      unreadPercent: sent > 0 ? Math.round((unread / sent) * 100) : 0,
      ctr,
      readRate,
      dailySent: daily,
      weeklySent: weekly,
      monthlySent: monthly,
      topPerforming: topTypes.map((t) => ({
        type: t.type,
        count: t._count,
      })),
    };
  }

  async createBroadcast(adminId: string, dto: CreateBroadcastDto) {
    if (dto.preview) {
      return {
        preview: true,
        title: dto.title,
        message: dto.message,
        target: dto.target,
        priority: dto.priority ?? 'normal',
      };
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isDraft = dto.draft === true;
    const isScheduled = scheduledAt && scheduledAt > new Date();

    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        adminId,
        title: dto.title.trim(),
        message: dto.message.trim(),
        target: dto.target,
        priority: dto.priority ?? 'normal',
        status: isDraft
          ? NotificationBroadcastStatus.draft
          : isScheduled
            ? NotificationBroadcastStatus.scheduled
            : NotificationBroadcastStatus.sent,
        scheduledAt: isScheduled ? scheduledAt : null,
        sentAt: !isDraft && !isScheduled ? new Date() : null,
      },
    });

    if (!isDraft && !isScheduled) {
      const result = await this.dispatcher.broadcastAnnouncement(adminId, {
        title: dto.title,
        message: dto.message,
        target: dto.target,
        priority: dto.priority,
        userId: dto.userId,
      });

      await this.prisma.notificationBroadcast.update({
        where: { id: broadcast.id },
        data: { recipientCount: result.sent },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'notification.broadcast',
          entityType: 'notification_broadcast',
          entityId: broadcast.id,
          newValue: { sent: result.sent, target: dto.target },
        },
      });

      return { broadcastId: broadcast.id, sent: result.sent, status: 'SENT' };
    }

    return {
      broadcastId: broadcast.id,
      status: isDraft ? 'DRAFT' : 'SCHEDULED',
      scheduledAt: scheduledAt?.toISOString() ?? null,
    };
  }

  async processScheduledBroadcasts() {
    const due = await this.prisma.notificationBroadcast.findMany({
      where: {
        status: NotificationBroadcastStatus.scheduled,
        scheduledAt: { lte: new Date() },
      },
      take: 10,
    });

    let sent = 0;
    for (const row of due) {
      const result = await this.dispatcher.broadcastAnnouncement(row.adminId, {
        title: row.title,
        message: row.message,
        target: row.target as CreateBroadcastDto['target'],
        priority: row.priority,
      });

      await this.prisma.notificationBroadcast.update({
        where: { id: row.id },
        data: {
          status: NotificationBroadcastStatus.sent,
          sentAt: new Date(),
          recipientCount: result.sent,
        },
      });
      sent++;
    }

    return { sent };
  }

  async refreshBroadcastMetrics() {
    const broadcasts = await this.prisma.notificationBroadcast.findMany({
      where: { status: NotificationBroadcastStatus.sent },
      take: 50,
      orderBy: { sentAt: 'desc' },
    });

    for (const b of broadcasts) {
      const related = await this.prisma.notification.findMany({
        where: {
          type: NotificationType.admin_announcement,
          title: b.title,
          createdAt: {
            gte: b.sentAt ? new Date(b.sentAt.getTime() - 60_000) : undefined,
          },
        },
        select: { isRead: true, clicked: true },
        take: 5000,
      });

      if (related.length === 0) continue;

      await this.prisma.notificationBroadcast.update({
        where: { id: b.id },
        data: {
          readCount: related.filter((n) => n.isRead).length,
          clickCount: related.filter((n) => n.clicked).length,
        },
      });
    }
  }
}