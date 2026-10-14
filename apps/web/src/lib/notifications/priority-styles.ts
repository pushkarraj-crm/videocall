import type { NotificationPriority, NotificationPriorityLabel } from '@/types/notifications';

export function priorityBadgeClass(
  priority: NotificationPriority | NotificationPriorityLabel,
): string {
  const key = priority.toString().toLowerCase();
  switch (key) {
    case 'low':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
    case 'high':
    case 'important':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'urgent':
      return 'bg-red-500/15 text-red-400 border-red-500/20';
    default:
      return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
  }
}

export function priorityAccentBorder(
  priority: NotificationPriority | NotificationPriorityLabel,
  isRead: boolean,
): string {
  if (isRead) return 'border-white/6';
  const key = priority.toString().toLowerCase();
  switch (key) {
    case 'urgent':
      return 'border-red-500/35 shadow-[0_8px_28px_rgba(239,68,68,0.12)]';
    case 'high':
    case 'important':
      return 'border-amber-500/30 shadow-[0_8px_24px_rgba(245,158,11,0.1)]';
    case 'low':
      return 'border-zinc-500/25 shadow-[0_8px_20px_rgba(113,113,122,0.08)]';
    default:
      return 'border-[#FF2E74]/25 shadow-[0_8px_24px_rgba(255,46,116,0.08)]';
  }
}