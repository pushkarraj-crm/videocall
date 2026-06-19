import { Injectable } from '@nestjs/common';
import { MessageModerationStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { canonicalPair } from '../../common/utils/canonical-pair.util';
import { PrismaService } from '../../database/prisma.service';

const SPAM_KEYWORDS = ['escort', 'nude', 'whatsapp me', 'pay outside'];

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

  async getOrCreateConversation(userA: string, userB: string) {
    const [participantAId, participantBId] = canonicalPair(userA, userB);

    return this.prisma.conversation.upsert({
      where: { participantAId_participantBId: { participantAId, participantBId } },
      update: {},
      create: { participantAId, participantBId },
    });
  }

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    if (
      conversation.participantAId !== userId &&
      conversation.participantBId !== userId
    ) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
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

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    if (
      conversation.participantAId !== senderId &&
      conversation.participantBId !== senderId
    ) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

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