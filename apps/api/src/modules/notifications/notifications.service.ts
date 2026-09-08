import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { serializeNotification } from '../../common/utils/notification-display';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationPreferenceFlags,
} from '../../common/utils/notification-settings.util';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEventsService } from './notification-events.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const tokenHash = this.hashToken(dto.token);

    return this.prisma.deviceToken.upsert({
      where: { userId_tokenHash: { userId, tokenHash } },
      update: { isActive: true, platform: dto.platform, lastUsedAt: new Date() },
      create: {
        userId,
        tokenHash,
        platform: dto.platform,
      },
    });
  }

  async unregisterDevice(userId: string, token: string) {
    const tokenHash = this.hashToken(token);

    return this.prisma.deviceToken.updateMany({
      where: { userId, tokenHash },
      data: { isActive: false },
    });
  }

  async getActiveTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { id: true, platform: true, lastUsedAt: true },
    });
  }

  async list(userId: string, page = 1, limit = 20, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), 50);
    const where: Prisma.NotificationWhereInput = { userId };

    if (cursor) {
      const anchor = await this.prisma.notification.findFirst({
        where: { id: cursor, userId },
        select: { createdAt: true },
      });
      if (anchor) {
        where.createdAt = { lt: anchor.createdAt };
      }
    }

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? {} : { skip: (Math.max(page, 1) - 1) * take }),
    });

    const hasMore = rows.length > take;
    const items = rows.slice(0, take).map((row) => serializeNotification(row));
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      page: cursor ? undefined : Math.max(page, 1),
      limit: take,
      hasMore,
      nextCursor,
    };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new BusinessException('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    if (existing.isRead) {
      const count = await this.prisma.notification.count({
        where: { userId, isRead: false },
      });
      return { notification: serializeNotification(existing), unreadCount: count };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, clicked: true },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.events.emit(userId, { event: 'unread_count', count: unreadCount });

    return {
      notification: serializeNotification(updated),
      unreadCount,
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    this.events.emit(userId, { event: 'unread_count', count: 0 });

    return { unreadCount: 0 };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new BusinessException('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    await this.prisma.notification.delete({ where: { id: notificationId } });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    this.events.emit(userId, { event: 'unread_count', count: unreadCount });

    return { deleted: true, unreadCount };
  }

  async getSettings(userId: string) {
    const row = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    return row ? this.serializeSettings(row) : DEFAULT_NOTIFICATION_SETTINGS;
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const row = await this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        incomingCalls: dto.incomingCalls ?? true,
        recharge: dto.recharge ?? true,
        referral: dto.referral ?? true,
        promotions: dto.promotions ?? true,
        withdrawals: dto.withdrawals ?? true,
        kyc: dto.kyc ?? true,
        reviews: dto.reviews ?? true,
        announcements: dto.announcements ?? true,
        browserPush: dto.browserPush ?? true,
        sound: dto.sound ?? true,
        vibration: dto.vibration ?? true,
      },
      update: {
        ...(dto.incomingCalls != null ? { incomingCalls: dto.incomingCalls } : {}),
        ...(dto.recharge != null ? { recharge: dto.recharge } : {}),
        ...(dto.referral != null ? { referral: dto.referral } : {}),
        ...(dto.promotions != null ? { promotions: dto.promotions } : {}),
        ...(dto.withdrawals != null ? { withdrawals: dto.withdrawals } : {}),
        ...(dto.kyc != null ? { kyc: dto.kyc } : {}),
        ...(dto.reviews != null ? { reviews: dto.reviews } : {}),
        ...(dto.announcements != null ? { announcements: dto.announcements } : {}),
        ...(dto.browserPush != null ? { browserPush: dto.browserPush } : {}),
        ...(dto.sound != null ? { sound: dto.sound } : {}),
        ...(dto.vibration != null ? { vibration: dto.vibration } : {}),
      },
    });

    return this.serializeSettings(row);
  }

  private serializeSettings(row: {
    incomingCalls: boolean;
    recharge: boolean;
    referral: boolean;
    promotions: boolean;
    withdrawals: boolean;
    kyc: boolean;
    reviews: boolean;
    announcements: boolean;
    browserPush: boolean;
    sound: boolean;
    vibration: boolean;
  }): NotificationPreferenceFlags {
    return {
      incomingCalls: row.incomingCalls,
      recharge: row.recharge,
      referral: row.referral,
      promotions: row.promotions,
      withdrawals: row.withdrawals,
      kyc: row.kyc,
      reviews: row.reviews,
      announcements: row.announcements,
      browserPush: row.browserPush,
      sound: row.sound,
      vibration: row.vibration,
    };
  }
}