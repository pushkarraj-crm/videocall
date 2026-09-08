import { Injectable, Logger } from '@nestjs/common';
import { CallEndReason, CallHostType, CallStatus } from '@prisma/client';
import type { CallRoutingPreferences } from '../../../common/utils/call-routing-engine';
import { PrismaService } from '../../../database/prisma.service';
import type { CallsService } from '../calls.service';

type FallbackContext = {
  callerId: string;
  callerIp?: string;
  timeoutMs: number;
  aiFallbackEnabled: boolean;
  prefs: CallRoutingPreferences;
};

/**
 * Real-host ring timeout.
 * When the host does not accept within realHostTimeoutSeconds the call is closed
 * with endReason=timeout so the client can surface "Host did not answer" (and
 * optionally re-match). AI seamless transfer is handled client-side via re-match
 * so the user always gets a stable callId navigation path.
 */
@Injectable()
export class CallFallbackScheduler {
  private readonly logger = new Logger(CallFallbackScheduler.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private callsService!: CallsService;

  constructor(private readonly prisma: PrismaService) {}

  bind(calls: CallsService) {
    this.callsService = calls;
  }

  /** Always schedule a ring timeout for real-host calls (not only when AI is enabled). */
  schedule(callId: string, ctx: FallbackContext) {
    this.cancel(callId, 'RESCHEDULED');

    const timeoutMs = Math.max(ctx.timeoutMs, 5_000);

    const timer = setTimeout(() => {
      this.timers.delete(callId);
      void this.execute(callId, ctx);
    }, timeoutMs);

    this.timers.set(callId, timer);
    this.logger.log(
      JSON.stringify({
        event: 'REAL_HOST_RING_SCHEDULED',
        callId,
        timeoutMs,
        aiFallbackEnabled: ctx.aiFallbackEnabled,
      }),
    );
  }

  cancel(callId: string, reason: string) {
    const timer = this.timers.get(callId);
    if (!timer) return;

    clearTimeout(timer);
    this.timers.delete(callId);
    this.logger.log(JSON.stringify({ event: 'REAL_HOST_RING_CANCELLED', callId, reason }));
  }

  private async execute(callId: string, ctx: FallbackContext) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: { status: true, hostCallType: true, callerId: true, answeredAt: true },
    });

    if (!call) return;

    if (call.hostCallType !== CallHostType.REAL_HOST) return;

    if (call.status === CallStatus.active || call.answeredAt) {
      this.logger.log(
        JSON.stringify({ event: 'REAL_HOST_RING_SKIP', callId, reason: 'ALREADY_ACTIVE' }),
      );
      return;
    }

    if (call.status !== CallStatus.initiated && call.status !== CallStatus.ringing) {
      this.logger.log(
        JSON.stringify({
          event: 'REAL_HOST_RING_SKIP',
          callId,
          reason: `STATUS_${call.status}`,
        }),
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: 'CALL_ROUTING_REAL_TIMEOUT',
        callId,
        callerId: ctx.callerId,
        timeoutMs: ctx.timeoutMs,
        aiFallbackEnabled: ctx.aiFallbackEnabled,
      }),
    );

    // Close unanswered real-host ring. Client must NOT treat this as a mid-call hangup —
    // it should show "Host did not answer" and allow retry / AI re-match.
    await this.callsService.endCall(callId, CallEndReason.timeout, ctx.callerId);
  }
}
