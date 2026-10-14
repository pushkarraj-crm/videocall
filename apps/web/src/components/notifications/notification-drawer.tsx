'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/notifications/format-time-ago';
import {
  NotificationIcon,
  notificationIconClass,
} from '@/lib/notifications/notification-icons';
import {
  priorityAccentBorder,
  priorityBadgeClass,
} from '@/lib/notifications/priority-styles';
import { NotificationEmptyState } from '@/components/notifications/notification-empty-state';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/api/notifications';
import type { AppNotification, NotificationTimeGroup } from '@/types/notifications';
import { useNotificationsStore } from '@/stores/notifications-store';

const GROUP_LABELS: Record<NotificationTimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
};

function groupNotifications(items: AppNotification[]) {
  const groups: Record<NotificationTimeGroup, AppNotification[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of items) {
    groups[item.timeGroup].push(item);
  }
  return (['today', 'yesterday', 'earlier'] as const).filter(
    (key) => groups[key].length > 0,
  ).map((key) => ({ key, items: groups[key] }));
}

export function NotificationDrawer() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const open = useNotificationsStore((s) => s.drawerOpen);
  const setDrawerOpen = useNotificationsStore((s) => s.setDrawerOpen);
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const isLoadingMore = useNotificationsStore((s) => s.isLoadingMore);
  const hasMore = useNotificationsStore((s) => s.hasMore);
  const fetchMore = useNotificationsStore((s) => s.fetchMore);
  const markReadLocal = useNotificationsStore((s) => s.markReadLocal);
  const markAllReadLocal = useNotificationsStore((s) => s.markAllReadLocal);
  const removeLocal = useNotificationsStore((s) => s.removeLocal);

  const grouped = useMemo(() => groupNotifications(items), [items]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isLoadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      void fetchMore();
    }
  }, [fetchMore, hasMore, isLoadingMore]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setDrawerOpen]);

  const handleItemClick = async (item: AppNotification) => {
    if (!item.isRead) {
      markReadLocal(item.id);
      try {
        await notificationsApi.markRead(item.id);
      } catch {
        /* optimistic */
      }
    }
    setDrawerOpen(false);
    router.push(item.actionRoute);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeLocal(id);
    try {
      await notificationsApi.delete(id);
    } catch {
      toast.error('Could not delete');
    }
  };

  const handleMarkAllRead = async () => {
    markAllReadLocal();
    try {
      await notificationsApi.markAllRead();
    } catch {
      /* optimistic */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/12 bg-[#101015]/75 shadow-[0_0_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#101015]/65"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF2E74]/15">
                  <Bell className="h-4 w-4 text-[#FF6B9D]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Notifications</h2>
                  {unreadCount > 0 && (
                    <p className="text-xs text-[#A7A7B3]">{unreadCount} unread</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[#A7A7B3] hover:text-white"
                    onClick={() => void handleMarkAllRead()}
                  >
                    <CheckCheck className="mr-1 h-3.5 w-3.5" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#A7A7B3] hover:text-white"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-4"
            >
              {isLoading && items.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-2xl bg-white/5"
                    />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <NotificationEmptyState />
              ) : (
                <div className="space-y-5">
                  {grouped.map((group) => (
                    <section key={group.key}>
                      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B78]">
                        {GROUP_LABELS[group.key]}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              'premium-card relative w-full rounded-2xl border p-4 transition-all duration-200 hover:bg-white/[0.03]',
                              item.isRead
                                ? 'border-white/6 bg-[#17171C]/60 opacity-85'
                                : cn('bg-[#1B1B22]/85', priorityAccentBorder(item.priority, false)),
                            )}
                          >
                            <button
                              type="button"
                              aria-label="Delete notification"
                              className="absolute right-3 top-3 rounded-lg p-1 text-[#6B6B78] hover:bg-white/5 hover:text-white"
                              onClick={(e) => void handleDelete(e, item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <motion.button
                              type="button"
                              layout
                              onClick={() => void handleItemClick(item)}
                              className="w-full text-left"
                            >
                            <div className="flex gap-3 pr-6">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                                />
                              ) : (
                                <div
                                  className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                    notificationIconClass(item.type),
                                  )}
                                >
                                  <NotificationIcon type={item.type} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {item.title}
                                  </p>
                                  {!item.isRead && (
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FF2E74]" />
                                  )}
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#A7A7B3]">
                                  {item.message}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#6B6B78]">
                                  <span>{formatTimeAgo(item.createdAt)}</span>
                                  {item.priority !== 'normal' && (
                                    <span
                                      className={cn(
                                        'rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide',
                                        priorityBadgeClass(item.priority),
                                      )}
                                    >
                                      {item.priorityLabel ?? item.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            </motion.button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                  {isLoadingMore && (
                    <div className="h-10 animate-pulse rounded-2xl bg-white/5" />
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}