import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CallEndReason,
  CallStatus,
  ConsentDocumentType,
  HostEarningStatus,
  Role,
  WalletTransactionType,
} from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ZegoService } from '../../integrations/zego/zego.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zego: ZegoService,
    private readonly wallet: WalletService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async initiateCall(callerId: string, calleeId: string, callerIp?: string) {
    if (callerId === calleeId) {
      throw new BusinessException('Cannot call yourself', 400, 'SELF_CALL');
    }

    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: callerId, blockedId: calleeId },
          { blockerId: calleeId, blockedId: callerId },
        ],
      },
    });

    if (blocked) {
      throw new BusinessException('User unavailable', 403, 'USER_BLOCKED');
    }

    const calleeRoles = await this.usersService.getUserRoles(calleeId);
    if (!calleeRoles.includes(Role.host)) {
      throw new BusinessException('Callee is not a host', 400, 'NOT_A_HOST');
    }

    const hostProfile = await this.prisma.hostProfile.findUnique({
      where: { userId: calleeId },
    });

    if (!hostProfile?.isAvailable) {
      throw new BusinessException('Host is not available', 400, 'HOST_UNAVAILABLE');
    }

    const caller = await this.prisma.user.findUniqueOrThrow({ where: { id: callerId } });
    const freeCallLimit = this.config.get<number>('FREE_CALL_LIMIT', 5);
    const coinsPerMinute = BigInt(this.config.get<number>('COINS_PER_MINUTE_UNITS', 500));
    const isFreeCall = caller.freeCallsUsed < freeCallLimit;

    if (!isFreeCall) {
      const summary = await this.wallet.getWalletSummary(callerId);
      if (summary.balanceCoins < Number(coinsPerMinute) / 100) {
        throw new BusinessException('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
      }
    }

    const roomId = this.zego.generateRoomId();

    const call = await this.prisma.call.create({
      data: {
        callerId,
        calleeId,
        zegoRoomId: roomId,
        status: CallStatus.initiated,
        isFreeCall,
        callerIp: callerIp ?? null,
      },
    });

    const callerToken = this.zego.generateToken({
      roomId,
      userId: callerId,
      userName: caller.displayName,
    });

    return {
      callId: call.id,
      roomId,
      zego: callerToken,
      isFreeCall,
    };
  }

  async recordConsent(callId: string, userId: string, documentVersion: string, ip?: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

    await this.prisma.callConsent.upsert({
      where: { callId_userId: { callId, userId } },
      update: { documentVersion, ipAddress: ip ?? null },
      create: {
        callId,
        userId,
        documentVersion,
        ipAddress: ip ?? null,
      },
    });

    await this.prisma.userConsent.create({
      data: {
        userId,
        documentType: ConsentDocumentType.pre_call,
        documentVersion,
        ipAddress: ip ?? null,
      },
    });

    return { consented: true };
  }

  async acceptCall(callId: string, hostId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.calleeId !== hostId) {
      throw new BusinessException('Not the callee', 403, 'NOT_CALLEE');
    }

    const [callerConsent, calleeConsent] = await Promise.all([
      this.prisma.callConsent.findUnique({
        where: { callId_userId: { callId, userId: call.callerId } },
      }),
      this.prisma.callConsent.findUnique({
        where: { callId_userId: { callId, userId: call.calleeId } },
      }),
    ]);

    if (!callerConsent || !calleeConsent) {
      throw new BusinessException('Both parties must consent before call', 400, 'CONSENT_REQUIRED');
    }

    const host = await this.prisma.user.findUniqueOrThrow({ where: { id: hostId } });

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.active,
        answeredAt: new Date(),
        startedAt: new Date(),
      },
    });

    const hostToken = this.zego.generateToken({
      roomId: call.zegoRoomId,
      userId: hostId,
      userName: host.displayName,
    });

    return { call: updated, zego: hostToken };
  }

  async rejectCall(callId: string, hostId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.calleeId !== hostId) {
      throw new BusinessException('Not the callee', 403, 'NOT_CALLEE');
    }

    return this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.rejected, endedAt: new Date() },
    });
  }

  async processBillingTick(callId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.status !== CallStatus.active) {
      throw new BusinessException('Call is not active', 400, 'CALL_NOT_ACTIVE');
    }

    if (call.isFreeCall) {
      return { billed: false, reason: 'free_call' };
    }

    const coinsPerMinute = BigInt(this.config.get<number>('COINS_PER_MINUTE_UNITS', 500));
    const platformFeePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 30);
    const hostSharePercent = 100 - platformFeePercent;

    const tickNumber =
      (await this.prisma.callBillingTick.count({ where: { callId } })) + 1;
    const idempotencyKey = `call:${callId}:tick:${tickNumber}`;

    const existing = await this.prisma.callBillingTick.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return { billed: true, tick: existing };
    }

    try {
      await this.wallet.debitWallet({
        userId: call.callerId,
        amountUnits: coinsPerMinute,
        type: WalletTransactionType.call_charge,
        referenceType: 'call',
        referenceId: callId,
        idempotencyKey,
        description: `Call minute ${tickNumber}`,
      });
    } catch {
      await this.endCall(callId, CallEndReason.balance_zero);
      return { billed: false, reason: 'balance_zero' };
    }

    const wallet = await this.wallet.getWalletSummary(call.callerId);
    const hostEarningUnits = (coinsPerMinute * BigInt(hostSharePercent)) / 100n;
    const platformFeeUnits = coinsPerMinute - hostEarningUnits;
    const holdDays = this.config.get<number>('WITHDRAWAL_HOLD_DAYS', 7) ?? 7;

    const tick = await this.prisma.$transaction(async (tx) => {
      const createdTick = await tx.callBillingTick.create({
        data: {
          callId,
          tickNumber,
          coinsDeductedUnits: coinsPerMinute,
          callerBalanceAfterUnits: BigInt(Math.round(wallet.balanceCoins * 100)),
          hostEarningUnits,
          platformFeeUnits,
          idempotencyKey,
        },
      });

      await tx.call.update({
        where: { id: callId },
        data: {
          coinsChargedUnits: { increment: coinsPerMinute },
          durationSeconds: { increment: 60 },
        },
      });

      await tx.hostEarning.create({
        data: {
          hostId: call.calleeId,
          callId,
          billingTickId: createdTick.id,
          grossUnits: coinsPerMinute,
          platformFeeUnits,
          netUnits: hostEarningUnits,
          status: HostEarningStatus.held,
          availableAt: new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000),
        },
      });

      await tx.hostProfile.update({
        where: { userId: call.calleeId },
        data: {
          totalEarningsUnits: { increment: hostEarningUnits },
          totalCallSeconds: { increment: 60 },
        },
      });

      return createdTick;
    });

    if (wallet.balanceCoins < Number(coinsPerMinute) / 100) {
      await this.endCall(callId, CallEndReason.balance_zero);
    }

    return { billed: true, tick };
  }

  async endCall(callId: string, reason: CallEndReason, userId?: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (userId && call.callerId !== userId && call.calleeId !== userId) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

    if (call.status === CallStatus.ended) {
      return call;
    }

    const endedAt = new Date();
    const durationSeconds = call.startedAt
      ? Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)
      : 0;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.ended,
          endedAt,
          durationSeconds,
          endReason: reason,
        },
      });

      if (call.isFreeCall) {
        await tx.user.update({
          where: { id: call.callerId },
          data: { freeCallsUsed: { increment: 1 } },
        });
      }

      await tx.hostProfile.update({
        where: { userId: call.calleeId },
        data: { totalCalls: { increment: 1 } },
      });

      return result;
    });

    return updated;
  }

  async getIncomingCalls(hostId: string) {
    const roles = await this.usersService.getUserRoles(hostId);
    if (!roles.includes(Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    const calls = await this.prisma.call.findMany({
      where: {
        calleeId: hostId,
        status: CallStatus.initiated,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      include: {
        caller: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      calls: calls.map((call) => ({
        callId: call.id,
        callerId: call.callerId,
        callerName: call.caller.displayName,
        callerAvatar: call.caller.avatarUrl,
        roomId: call.zegoRoomId,
        isFreeCall: call.isFreeCall,
        createdAt: call.createdAt,
      })),
    };
  }

  async getCallHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.call.findMany({
        where: { OR: [{ callerId: userId }, { calleeId: userId }] },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          callerId: true,
          calleeId: true,
          status: true,
          isFreeCall: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          coinsChargedUnits: true,
          endReason: true,
          createdAt: true,
        },
      }),
      this.prisma.call.count({
        where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      }),
    ]);

    return {
      items: items.map((c) => ({
        ...c,
        coinsChargedUnits: c.coinsChargedUnits.toString(),
      })),
      total,
      page,
      limit,
    };
  }
}