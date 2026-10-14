'use client';

import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationsStore } from '@/stores/notifications-store';

export function NotificationBell() {
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const badgePulse = useNotificationsStore((s) => s.badgePulse);
  const setDrawerOpen = useNotificationsStore((s) => s.setDrawerOpen);

  return (
    <button
      type="button"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      onClick={() => setDrawerOpen(true)}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#A7A7B3] transition-all duration-200 hover:border-white/20 hover:bg-white/8 hover:text-white',
      )}
    >
      <span
        className={cn('flex items-center justify-center', badgePulse && 'notification-bell-pulse')}
      >
        <Bell className="h-5 w-5" />
      </span>

        {unreadCount > 0 && (
          <span
            key={unreadCount}
            className={cn('absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF2E74] px-1 text-[10px] font-bold text-white shadow-[0_2px_10px_rgba(255,46,116,0.55)]', badgePulse && 'notification-badge-pulse')}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
    </button>
  );
}
