import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CallEndReason,
  CallHostType,
  CallStatus,
  ConsentDocumentType,
  HostEarningStatus,
  Role,
  WalletTransactionType,
} from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ZegoService } from '../../integrations/zego/zego.service';
import { CallHistoryService } from '../call-history/call-history.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { unitsToCoins } from '../../common/constants/coins';
import {
  resolveCoinsPerMinuteUnits,
  unitsToCoinsPerMinute,
} from '../../common/utils/coin-pricing';
import { serializeCall } from '../../common/utils/serialize-call';
import { GiftsService } from '../gifts/gifts.service';
import { VirtualHostsService } from '../virtual-hosts/virtual-hosts.service';
import {
  isVirtualHostProfile,
  syncVirtualHostAvailability,
} from '../../common/utils/virtual-host';
import { AiHostAssetsService } from '../../integrations/ai-host-assets/ai-host-assets.service';
import { CallRoutingService } from './routing/call-routing.service';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zego: ZegoService,
    private readonly wallet: WalletService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    private readonly callHistory: CallHistoryService,
    private readonly notifications: NotificationDispatcherService,
    private readonly notificationEvents: NotificationEventsService,
    private readonly giftsService: GiftsService,
    private readonly virtualHosts: VirtualHostsService,
    private readonly aiHostAssets: AiHostAssetsService,
    @Inject(forwardRef(() => CallRoutingService))
    private readonly callRouting: CallRoutingService,
  ) {}

  private emitCallStatus(callId: string, participantIds: string[], status: CallStatus) {
    for (const userId of new Set(participantIds)) {
      this.notificationEvents.emit(userId, { event: 'call_status', callId, status });
    }
  }

  /** Non-blocking history sync — never affects call flow. */
  private recordHistory(
    action: 'initiated' | 'accepted' | 'rejected' | 'ended',
    callId: string,
    endedByUserId?: string,
  ) {
    const task =
      action === 'initiated'
        ? this.callHistory.onCallInitiated(callId)
        : action === 'accepted'
          ? this.callHistory.onCallAccepted(callId)
          : action === 'rejected'
            ? this.callHistory.onCallRejected(callId)
            : this.callHistory.onCallEnded(callId, endedByUserId);

    void task.catch((err) =>
      this.logger.warn(`Call history sync failed (${action}/${callId}): ${err}`),
    );
  }

  async initiateCall(
    callerId: string,
    calleeId: string,
    callerIp?: string,
    options?: { hostCallType?: CallHostType; lockedVideoUrl?: string },
  ) {
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
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            gender: true,
            primaryLanguage: true,
          },
        },
      },
    });

    if (!hostProfile) {
      throw new BusinessException('Callee is not a host', 400, 'NOT_A_HOST');
    }

    const isVirtual = isVirtualHostProfile(hostProfile);

    if (isVirtual) {
      await this.virtualHosts.assertCanReceiveCall(hostProfile);
    } else {
      if (!hostProfile.isOnline) {
        throw new BusinessException('Host is currently offline', 400, 'HOST_OFFLINE');
      }
      if (hostProfile.isBusy) {
        throw new BusinessException('Host is on another call', 400, 'HOST_BUSY');
      }
      if (hostProfile.adminCallsDisabled) {
        throw new BusinessException('Host is not accepting calls', 403, 'HOST_CALLS_DISABLED');
      }
    }

    const caller = await this.prisma.user.findUniqueOrThrow({ where: { id: callerId } });
    const freeCallLimit = this.config.get<number>('FREE_CALL_LIMIT', 5);
    const coinsPerMinute = resolveCoinsPerMinuteUnits(hostProfile.coinsPerMinuteUnits, this.config);
    const isFreeCall = caller.freeCallsUsed < freeCallLimit;

    if (!isFreeCall) {
      const summary = await this.wallet.getWalletSummary(callerId);
      if (summary.balanceCoins < unitsToCoinsPerMinute(coinsPerMinute)) {
        throw new BusinessException('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
      }
    }

    const hostCallType =
      options?.hostCallType ??
      (isVirtual ? CallHostType.AI_HOST : CallHostType.REAL_HOST);

    // Create call first, then bind a deterministic Zego roomId to the call id
    // so caller and callee can never receive different rooms for the same call.
    const provisionalRoomId = this.zego.generateRoomId();
    const call = await this.prisma.call.create({
      data: {
        callerId,
        calleeId,
        zegoRoomId: provisionalRoomId,
        status: CallStatus.initiated,
        isFreeCall,
        callerIp: callerIp ?? null,
        hostCallType,
        coinsPerMinuteUnits: coinsPerMinute,
      },
    });

    const roomId = this.zego.generateRoomId(call.id);
    const withRoom =
      roomId !== provisionalRoomId
        ? await this.prisma.call.update({
            where: { id: call.id },
            data: { zegoRoomId: roomId },
          })
        : call;

    this.logger.log(
      JSON.stringify({
        event: 'CALL_CREATED',
        callId: withRoom.id,
        callerId,
        calleeId,
        status: withRoom.status,
        roomId,
        hostCallType,
      }),
    );
    this.logger.log(
      JSON.stringify({
        event: 'HOST_NOTIFY_SENT',
        callId: withRoom.id,
        hostId: calleeId,
        callerId,
        status: withRoom.status,
      }),
    );

    const callerToken = this.zego.generateToken({
      roomId,
      userId: callerId,
      userName: caller.displayName,
    });

    this.recordHistory('initiated', withRoom.id);

    let virtualSession: { sessionId: string; profileType: string } | null = null;
    let lockedVideoUrl: string | null = options?.lockedVideoUrl ?? null;
    if (isVirtual) {
      virtualSession = await this.virtualHosts.createSession(withRoom.id, callerId, calleeId);
      if (!lockedVideoUrl) {
        lockedVideoUrl = this.resolveLockedAiVideo(hostProfile);
      }
      if (lockedVideoUrl) {
        await this.prisma.virtualHostSession.update({
          where: { callId: withRoom.id },
          data: { lockedVideoUrl },
        });
      }
    } else {
      this.notifications.dispatchSafe(
        this.notifications.onIncomingCall(
          withRoom.id,
          calleeId,
          callerId,
          caller.displayName,
          caller.avatarUrl,
        ),
        `incoming_call/${withRoom.id}`,
      );
    }

    return {
      callId: withRoom.id,
      roomId,
      zego: callerToken,
      isFreeCall,
      isVirtualHost: isVirtual,
      profileType: hostProfile.profileType,
      hostCallType,
      virtualHost: isVirtual ? this.virtualHosts.serializeVirtualHostMeta(hostProfile) : undefined,
      virtualSessionId: virtualSession?.sessionId,
      lockedVideoUrl: isVirtual ? lockedVideoUrl : undefined,
      coinsPerMinute: unitsToCoinsPerMinute(coinsPerMinute),
    };
  }

  private resolveLockedAiVideo(hostProfile: {
    virtualHostAssetSlug?: string | null;
  }): string | null {
    return this.aiHostAssets.pickRandomIdleVideo(hostProfile.virtualHostAssetSlug);
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

    const autoAccept = await this.virtualHosts.handleCallerConsent(
      callId,
      documentVersion,
      ip,
      call.callerId === userId
        ? (id, hostId) => this.acceptCall(id, hostId)
        : undefined,
    );

    return { consented: true, autoAccepted: autoAccept.autoAccepted };
  }

  async getCallById(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        callerId: true,
        calleeId: true,
        status: true,
        isFreeCall: true,
        startedAt: true,
        endedAt: true,
        zegoRoomId: true,
        hostCallType: true,
        coinsPerMinuteUnits: true,
        caller: { select: { displayName: true } },
        callee: { select: { displayName: true } },
      },
    });

    if (!call) {
      throw new BusinessException('Call not found', 404, 'CALL_NOT_FOUND');
    }

    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

    const userConsent = await this.prisma.callConsent.findUnique({
      where: { callId_userId: { callId, userId } },
      select: { id: true },
    });

    const participantName =
      call.callerId === userId ? call.caller.displayName : call.callee.displayName;

    const zego = this.zego.generateToken({
      roomId: call.zegoRoomId,
      userId,
      userName: participantName,
    });

    const hostProfile = await this.prisma.hostProfile.findUnique({
      where: { userId: call.calleeId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            gender: true,
            primaryLanguage: true,
          },
        },
      },
    });

    const isVirtual = hostProfile ? isVirtualHostProfile(hostProfile) : false;

    const session = isVirtual
      ? await this.prisma.virtualHostSession.findUnique({
          where: { callId: call.id },
          select: { lockedVideoUrl: true },
        })
      : null;

    return {
      id: call.id,
      callerId: call.callerId,
      calleeId: call.calleeId,
      status: call.status,
      isFreeCall: call.isFreeCall,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      zegoRoomId: call.zegoRoomId,
      hasConsented: Boolean(userConsent),
      isVirtualHost: isVirtual,
      profileType: hostProfile?.profileType ?? 'REAL_HOST',
      hostCallType: call.hostCallType,
      virtualHost:
        isVirtual && hostProfile
          ? this.virtualHosts.serializeVirtualHostMeta(hostProfile)
          : undefined,
      lockedVideoUrl: session?.lockedVideoUrl ?? undefined,
      coinsPerMinute: unitsToCoinsPerMinute(call.coinsPerMinuteUnits),
      zego,
    };
  }

  private async ensureCallActive(call: {
    id: string;
    status: CallStatus;
    callerId: string;
    calleeId: string;
    startedAt: Date | null;
    answeredAt: Date | null;
    isFreeCall: boolean;
  }) {
    if (call.status === CallStatus.active) {
      return call;
    }

    if (call.status !== CallStatus.initiated) {
      throw new BusinessException('Call is not active', 400, 'CALL_NOT_ACTIVE');
    }

    const [callerConsent, calleeConsent] = await Promise.all([
      this.prisma.callConsent.findUnique({
        where: { callId_userId: { callId: call.id, userId: call.callerId } },
      }),
      this.prisma.callConsent.findUnique({
        where: { callId_userId: { callId: call.id, userId: call.calleeId } },
      }),
    ]);

    if (!callerConsent || !calleeConsent) {
      throw new BusinessException('Call is not active', 400, 'CALL_NOT_ACTIVE');
    }

    const now = new Date();
    const updated = await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: CallStatus.active,
        startedAt: call.startedAt ?? now,
        answeredAt: call.answeredAt ?? now,
      },
    });
    this.emitCallStatus(call.id, [call.callerId, call.calleeId], updated.status);
    return updated;
  }

  async acceptCall(callId: string, hostId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.calleeId !== hostId) {
      throw new BusinessException('Not the callee', 403, 'NOT_CALLEE');
    }

    if (call.status !== CallStatus.initiated) {
      throw new BusinessException('Call is no longer available', 400, 'CALL_NOT_AVAILABLE');
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const activeCall = await tx.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.active,
          answeredAt: new Date(),
          startedAt: new Date(),
        },
      });

      await tx.hostProfile.update({
        where: { userId: hostId },
        data: { isBusy: true, isAvailable: false },
      });

      return activeCall;
    });

    const hostToken = this.zego.generateToken({
      roomId: call.zegoRoomId,
      userId: hostId,
      userName: host.displayName,
    });

    this.callRouting.cancelAiFallback(callId, 'HOST_ACCEPTED');
    this.emitCallStatus(callId, [call.callerId, call.calleeId], updated.status);

    this.logger.log(
      JSON.stringify({
        event: 'HOST_ACCEPTED',
        callId,
        hostId,
        roomId: call.zegoRoomId,
        hostCallType: call.hostCallType,
      }),
    );

    this.recordHistory('accepted', callId);

    return { call: serializeCall(updated), zego: hostToken };
  }

  async rejectCall(callId: string, hostId: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.calleeId !== hostId) {
      throw new BusinessException('Not the callee', 403, 'NOT_CALLEE');
    }

    if (call.status !== CallStatus.initiated) {
      throw new BusinessException('Call is no longer available', 400, 'CALL_NOT_AVAILABLE');
    }

    const rejected = await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.rejected, endedAt: new Date() },
    });
    this.emitCallStatus(callId, [call.callerId, call.calleeId], rejected.status);
    this.recordHistory('rejected', callId);

    const host = await this.prisma.user.findUniqueOrThrow({
      where: { id: hostId },
      select: { displayName: true },
    });
    this.callRouting.cancelAiFallback(callId, 'HOST_REJECTED');

    this.notifications.dispatchSafe(
      this.notifications.onCallRejected(callId, call.callerId, host.displayName),
      `call_rejected/${callId}`,
    );

    return serializeCall(rejected);
  }

  async processBillingTick(callId: string, userId?: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (userId && call.callerId !== userId) {
      throw new BusinessException('Only the caller can bill', 403, 'NOT_CALLER');
    }

    const activeCall = await this.ensureCallActive(call);

    if (activeCall.isFreeCall) {
      const freeMaxSeconds = this.config.get<number>('FREE_CALL_MAX_SECONDS', 180);
      const elapsedSeconds = activeCall.startedAt
        ? Math.floor((Date.now() - activeCall.startedAt.getTime()) / 1000)
        : 0;

      if (elapsedSeconds <= freeMaxSeconds) {
        return { billed: false, reason: 'free_call' };
      }
    }

    const lastTick = await this.prisma.callBillingTick.findFirst({
      where: { callId },
      orderBy: { tickNumber: 'desc' },
    });
    const billingAnchor = lastTick?.createdAt ?? activeCall.startedAt;
    if (!billingAnchor) {
      return { billed: false, reason: 'not_started' };
    }
    const secondsSinceLastBill = Math.floor((Date.now() - billingAnchor.getTime()) / 1000);
    if (secondsSinceLastBill < 55) {
      return { billed: false, reason: 'too_soon' };
    }

    const coinsPerMinute = call.coinsPerMinuteUnits ?? resolveCoinsPerMinuteUnits(null, this.config);
    const platformFeePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 30);
    const hostSharePercent = 100 - platformFeePercent;

    const tickNumber =
      (await this.prisma.callBillingTick.count({ where: { callId } })) + 1;
    const idempotencyKey = `call:${callId}:tick:${tickNumber}`;

    const existing = await this.prisma.callBillingTick.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      const walletSummary = await this.wallet.getWalletSummary(call.callerId);
      const rateCoins = unitsToCoinsPerMinute(coinsPerMinute);
      return {
        billed: true,
        tick: this.serializeBillingTick(existing),
        balanceCoins: walletSummary.balanceCoins,
        coinsPerMinute: rateCoins,
        lowBalance: walletSummary.balanceCoins < rateCoins,
      };
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
      const walletSummary = await this.wallet.getWalletSummary(call.callerId);
      const rateCoins = unitsToCoinsPerMinute(coinsPerMinute);
      return {
        billed: false,
        reason: 'balance_zero',
        balanceCoins: walletSummary.balanceCoins,
        coinsPerMinute: rateCoins,
        lowBalance: true,
      };
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

    await this.wallet.recordLedgerEntry({
      userId: call.calleeId,
      amountUnits: hostEarningUnits,
      type: WalletTransactionType.call_earning,
      referenceType: 'host_earning',
      referenceId: tick.id,
      idempotencyKey: `ledger:call_earning:${tick.id}`,
      description: `Call minute ${tickNumber}`,
    });

    const rateCoins = unitsToCoinsPerMinute(coinsPerMinute);
    const lowBalance = wallet.balanceCoins < rateCoins;

    if (lowBalance) {
      await this.endCall(callId, CallEndReason.balance_zero);
      return {
        billed: false,
        reason: 'balance_zero',
        balanceCoins: wallet.balanceCoins,
        coinsPerMinute: rateCoins,
        lowBalance: true,
      };
    }

    return {
      billed: true,
      tick: this.serializeBillingTick(tick),
      balanceCoins: wallet.balanceCoins,
      coinsPerMinute: rateCoins,
      lowBalance,
    };
  }

  private serializeBillingTick(tick: {
    id: string;
    callId: string;
    tickNumber: number;
    coinsDeductedUnits: bigint;
    callerBalanceAfterUnits: bigint;
    hostEarningUnits: bigint;
    platformFeeUnits: bigint;
    idempotencyKey: string;
    createdAt: Date;
  }) {
    return {
      ...tick,
      coinsDeductedUnits: tick.coinsDeductedUnits.toString(),
      callerBalanceAfterUnits: tick.callerBalanceAfterUnits.toString(),
      hostEarningUnits: tick.hostEarningUnits.toString(),
      platformFeeUnits: tick.platformFeeUnits.toString(),
    };
  }

  async sendGift(
    callId: string,
    senderId: string,
    giftId: string,
    quantity = 1,
    clientIdempotencyKey?: string,
  ) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (call.callerId !== senderId) {
      throw new BusinessException('Only the caller can send gifts', 403, 'NOT_CALLER');
    }

    await this.ensureCallActive(call);

    const resolved = await this.giftsService.resolveGift(giftId);
    const qty = Math.min(Math.max(quantity, 1), 99);
    const giftUnits = resolved.units * BigInt(qty);
    const platformFeePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 30);
    const hostSharePercent = 100 - platformFeePercent;
    const hostEarningUnits = (giftUnits * BigInt(hostSharePercent)) / 100n;
    const platformFeeUnits = giftUnits - hostEarningUnits;
    const holdDays = this.config.get<number>('WITHDRAWAL_HOLD_DAYS', 7) ?? 7;

    const giftCount = await this.prisma.callGift.count({ where: { callId } });
    const idempotencyKey =
      clientIdempotencyKey?.trim() || `gift:${callId}:${giftCount + 1}`;

    const existing = await this.prisma.callGift.findUnique({
      where: { idempotencyKey },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        catalogGift: true,
      },
    });
    if (existing) {
      const wallet = await this.wallet.getWalletSummary(senderId);
      return {
        gift: this.giftsService.serializeCallGiftEvent(existing),
        balanceCoins: wallet.balanceCoins,
        combo: { giftId: existing.giftType, quantity: existing.quantity },
      };
    }

    await this.wallet.debitWallet({
      userId: senderId,
      amountUnits: giftUnits,
      type: WalletTransactionType.gift_send,
      referenceType: 'call_gift',
      referenceId: callId,
      idempotencyKey,
      description: qty > 1 ? `Gift: ${giftId} x${qty}` : `Gift: ${giftId}`,
    });

    const wallet = await this.wallet.getWalletSummary(senderId);

    const createdGift = await this.prisma.$transaction(async (tx) => {
      const callGift = await tx.callGift.create({
        data: {
          callId,
          senderId,
          recipientId: call.calleeId,
          giftType: resolved.slug,
          catalogGiftId: resolved.catalogGiftId,
          quantity: qty,
          coinUnits: giftUnits,
          hostEarningUnits,
          platformFeeUnits,
          idempotencyKey,
        },
      });

      await tx.call.update({
        where: { id: callId },
        data: {
          coinsChargedUnits: { increment: giftUnits },
        },
      });

      await tx.hostEarning.create({
        data: {
          hostId: call.calleeId,
          callId,
          grossUnits: giftUnits,
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
        },
      });

      return callGift;
    });

    await this.wallet.recordLedgerEntry({
      userId: call.calleeId,
      amountUnits: hostEarningUnits,
      type: WalletTransactionType.gift_receive,
      referenceType: 'call_gift',
      referenceId: createdGift.id,
      idempotencyKey: `ledger:gift_receive:${createdGift.id}`,
      description: `Gift: ${giftId}`,
    });

    const sender = await this.prisma.user.findUniqueOrThrow({
      where: { id: senderId },
      select: { id: true, displayName: true, avatarUrl: true },
    });

    const hostProfile = await this.prisma.hostProfile.findUnique({
      where: { userId: call.calleeId },
    });
    let giftReaction;
    if (hostProfile && isVirtualHostProfile(hostProfile)) {
      await this.virtualHosts.recordGiftInSession(callId);
      giftReaction = this.virtualHosts.getGiftReaction(hostProfile, resolved.slug);
    }

    const giftEvent = {
      id: createdGift.id,
      giftId: createdGift.giftType,
      quantity: qty,
      coinCoins: unitsToCoins(createdGift.coinUnits),
      hostEarningCoins: unitsToCoins(createdGift.hostEarningUnits),
      createdAt: createdGift.createdAt.toISOString(),
      sender,
      gift: {
        name: resolved.name,
        icon: resolved.icon,
        animationTier: resolved.animationTier,
        animationKey: resolved.animationKey,
        category: resolved.category,
      },
    };
    this.notificationEvents.emit(call.calleeId, {
      event: 'call_gift',
      callId,
      gift: giftEvent,
    });

    return {
      gift: giftEvent,
      balanceCoins: wallet.balanceCoins,
      combo: { giftId: resolved.slug, quantity: qty },
      giftReaction,
    };
  }

  async endCall(callId: string, reason: CallEndReason, userId?: string) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });

    if (userId && call.callerId !== userId && call.calleeId !== userId) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

    if (call.status === CallStatus.ended) {
      return serializeCall(call);
    }

    if (
      call.status === CallStatus.active &&
      reason === CallEndReason.timeout
    ) {
      this.callRouting.cancelAiFallback(callId, 'ALREADY_ACTIVE');
      return serializeCall(call);
    }

    this.callRouting.cancelAiFallback(callId, 'CALL_ENDED');

    const endedAt = new Date();
    const wallClockSeconds = call.startedAt
      ? Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)
      : 0;
    const durationSeconds = Math.max(call.durationSeconds, wallClockSeconds);

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

      const hostProfile = await tx.hostProfile.findUnique({
        where: { userId: call.calleeId },
        select: {
          isOnline: true,
          profileType: true,
          virtualHostEnabled: true,
        },
      });

      const hostAvailabilityUpdate =
        hostProfile &&
        isVirtualHostProfile(hostProfile) &&
        hostProfile.virtualHostEnabled
          ? syncVirtualHostAvailability('ONLINE')
          : {
              isBusy: false,
              isAvailable: hostProfile?.isOnline ?? false,
            };

      await tx.hostProfile.update({
        where: { userId: call.calleeId },
        data: {
          totalCalls: { increment: 1 },
          ...hostAvailabilityUpdate,
        },
      });

      return result;
    });
    this.emitCallStatus(callId, [call.callerId, call.calleeId], updated.status);

    this.logger.log(
      JSON.stringify({
        event: 'CALL_ENDED',
        callId,
        reason,
        userId: userId ?? null,
      }),
    );

    this.recordHistory('ended', callId, userId);

    try {
      await this.virtualHosts.finalizeSession(callId, {
        callerId: call.callerId,
        calleeId: call.calleeId,
        durationSeconds,
        coinsChargedUnits: updated.coinsChargedUnits,
        startedAt: call.startedAt,
      });
    } catch (err) {
      this.logger.warn(`Virtual host session finalize failed (${callId}): ${err}`);
    }

    const wasUnanswered =
      !call.answeredAt &&
      (call.status === CallStatus.initiated || call.status === CallStatus.ringing);

    if (wasUnanswered) {
      if (reason === CallEndReason.timeout) {
        const host = await this.prisma.user.findUniqueOrThrow({
          where: { id: call.calleeId },
          select: { displayName: true },
        });
        this.notifications.dispatchSafe(
          this.notifications.onMissedCall(callId, call.callerId, host.displayName),
          `missed_call/${callId}`,
        );
      } else if (reason === CallEndReason.user_ended && userId === call.callerId) {
        this.notifications.dispatchSafe(
          this.notifications.onCallCancelled(callId, call.callerId),
          `call_cancelled/${callId}`,
        );
      }
    }

    return serializeCall(updated);
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

    if (calls.length > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'HOST_INCOMING_QUERY',
          hostId,
          count: calls.length,
          callIds: calls.map((c) => c.id),
          callerIds: calls.map((c) => c.callerId),
        }),
      );
    }

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
