export type CallHistoryDisplayStatus =
  | 'RINGING'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'MISSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export const CALL_HISTORY_STATUS_LABELS: Record<CallHistoryDisplayStatus, string> = {
  RINGING: 'Ringing',
  CONNECTED: 'Connected',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

export const CALL_HISTORY_STATUS_STYLES: Record<CallHistoryDisplayStatus, string> = {
  RINGING: 'bg-sky-500/15 text-sky-400',
  CONNECTED: 'bg-blue-500/15 text-blue-400',
  COMPLETED: 'bg-emerald-500/15 text-emerald-400',
  MISSED: 'bg-amber-500/15 text-amber-400',
  REJECTED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-zinc-500/15 text-zinc-400',
  FAILED: 'bg-rose-500/15 text-rose-400',
};