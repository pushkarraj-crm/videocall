import { Injectable } from '@nestjs/common';
import { MessageModerationStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { canonicalPair } from '../../common/utils/canonical-pair.util';
import { PrismaService } from '../../database/prisma.service';

const SPAM_KEYWORDS = ['escort', 'nude', 'whatsapp me', 'pay outside'];

const participantSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  lastSeenAt: true,
} as const;

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  private moderate(content: string): MessageModerationStatus {
    const lower = content.toLowerCase();
    for (const word of SPAM_KEYWORDS) {
      if (lower.includes(word)) return MessageModerationStatus.flagged;
    }
    return MessageModerationStatus.approved;
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    if (
      conversation.participantAId !== userId &&
      conversation.participantBId !== userId
    ) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

    return conversation;
  }

  private otherParticipant(
    conversation: { participantAId: string; participantBId: string },
    userId: string,
  ) {
    return conversation.participantAId === userId
      ? conversation.participantBId
      : conversation.participantAId;
  }

  private async touchPresence(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  }

  async getOrCreateConversation(userA: string, userB: string) {
    const [participantAId, participantBId] = canonicalPair(userA, userB);

    return this.prisma.conversation.upsert({
      where: { participantAId_participantBId: { participantAId, participantBId } },
      update: {},
      create: { participantAId, participantBId },
    });
  }

  async listConversations(userId: string) {
    await this.touchPresence(userId);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participantA: { select: participantSelect },
        participantB: { select: participantSelect },
        _count: {
          select: {
            messages: {
              where: {
                deletedAt: null,
                senderId: { not: userId },
                readAt: null,
              },
            },
          },
        },
      },
    });

    return conversations.map((conversation) => {
      const other =
        conversation.participantAId === userId
          ? conversation.participantB
          : conversation.participantA;

      return {
        id: conversation.id,
        participantAId: conversation.participantAId,
        participantBId: conversation.participantBId,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        unreadCount: conversation._count.messages,
        participant: other,
      };
    });
  }

  async getConversation(conversationId: string, userId: string) {
    await this.touchPresence(userId);

    const conversation = await this.assertParticipant(conversationId, userId);
    const otherId = this.otherParticipant(conversation, userId);

    const [participant, unreadCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: otherId },
        select: participantSelect,
      }),
      this.prisma.message.count({
        where: {
          conversationId,
          deletedAt: null,
          senderId: { not: userId },
          readAt: null,
        },
      }),
    ]);

    return {
      id: conversation.id,
      participantAId: conversation.participantAId,
      participantBId: conversation.participantBId,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      unreadCount,
      participant,
    };
  }

  async getUnreadTotal(userId: string) {
    const total = await this.prisma.message.count({
      where: {
        deletedAt: null,
        readAt: null,
        senderId: { not: userId },
        conversation: {
          deletedAt: null,
          OR: [{ participantAId: userId }, { participantBId: userId }],
        },
      },
    });

    return { total };
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
    since?: string,
  ) {
    await this.touchPresence(userId);
    await this.assertParticipant(conversationId, userId);

    if (since) {
      const messages = await this.prisma.message.findMany({
        where: {
          conversationId,
          deletedAt: null,
          createdAt: { gt: new Date(since) },
        },
        orderBy: { createdAt: 'asc' },
      });

      return { messages, total: messages.length, page: 1, limit };
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId, deletedAt: null } }),
    ]);

    return { messages: messages.reverse(), total, page, limit };
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.touchPresence(userId);
    await this.assertParticipant(conversationId, userId);

    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
        deletedAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    await this.touchPresence(senderId);

    const conversation = await this.assertParticipant(conversationId, senderId);

    const moderationStatus = this.moderate(content);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        moderationStatus,
        flaggedReason:
          moderationStatus === MessageModerationStatus.flagged
            ? 'auto_keyword'
            : null,
      },
    });

    if (moderationStatus === MessageModerationStatus.approved) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: content.slice(0, 100),
        },
      });
    }

    return message;
  }
}