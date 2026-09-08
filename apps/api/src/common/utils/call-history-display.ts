import { CallEndReason, CallHistoryStatus, CallStatus } from '@prisma/client';

export type CallHistoryDisplayStatus =
  | 'RINGING'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'MISSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export function historyDisplayStatus(status: CallHistoryStatus): CallHistoryDisplayStatus {
  switch (status) {
    case CallHistoryStatus.ringing:
      return 'RINGING';
    case CallHistoryStatus.connected:
      return 'CONNECTED';
    case CallHistoryStatus.completed:
      return 'COMPLETED';
    case CallHistoryStatus.missed:
      return 'MISSED';
    case CallHistoryStatus.rejected:
      return 'REJECTED';
    case CallHistoryStatus.cancelled:
      return 'CANCELLED';
    case CallHistoryStatus.failed:
      return 'FAILED';
    default:
      return 'COMPLETED';
  }
}

export function mapCallToHistoryStatus(
  callStatus: CallStatus,
  endReason: CallEndReason | null,
  answeredAt: Date | null,
): CallHistoryStatus {
  if (callStatus === CallStatus.rejected) return CallHistoryStatus.rejected;
  if (callStatus === CallStatus.cancelled) return CallHistoryStatus.cancelled;
  if (callStatus === CallStatus.missed) return CallHistoryStatus.missed;
  if (callStatus === CallStatus.initiated || callStatus === CallStatus.ringing) {
    return CallHistoryStatus.ringing;
  }
  if (callStatus === CallStatus.active) return CallHistoryStatus.connected;

  if (callStatus === CallStatus.ended) {
    if (endReason === CallEndReason.network_error) return CallHistoryStatus.failed;
    if (endReason === CallEndReason.timeout) return CallHistoryStatus.missed;
    if (!answeredAt) return CallHistoryStatus.cancelled;
    return CallHistoryStatus.completed;
  }

  return CallHistoryStatus.completed;
}

export const HISTORY_STATUS_STYLES: Record<CallHistoryDisplayStatus, string> = {
  RINGING: 'bg-sky-500/15 text-sky-400',
  CONNECTED: 'bg-blue-500/15 text-blue-400',
  COMPLETED: 'bg-emerald-500/15 text-emerald-400',
  MISSED: 'bg-amber-500/15 text-amber-400',
  REJECTED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-zinc-500/15 text-zinc-400',
  FAILED: 'bg-rose-500/15 text-rose-400',
};