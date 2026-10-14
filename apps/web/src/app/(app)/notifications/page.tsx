'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';
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
import { notificationsApi } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';
import { useNotificationsStore } from '@/stores/notifications-store';
import type { AppNotification } from '@/types/notifications';

const GROUP_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
} as const;

function groupItems(items: AppNotification[]) {
  const groups = {
    today: [] as AppNotification[],
    yesterday: [] as AppNotification[],
    earlier: [] as AppNotification[],
  };
  for (const item of items) groups[item.timeGroup].push(item);
  return (['today', 'yesterday', 'earlier'] as const)
    .filter((k) => groups[k].length > 0)
    .map((k) => ({ key: k, items: groups[k] }));
}

export default function NotificationsPage() {
  const router = useRouter();
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const fetchInitial = useNotificationsStore((s) => s.fetchInitial);
  const fetchMore = useNotificationsStore((s) => s.fetchMore);
  const hasMore = useNotificationsStore((s) => s.hasMore);
  const markReadLocal = useNotificationsStore((s) => s.markReadLocal);
  const markAllReadLocal = useNotificationsStore((s) => s.markAllReadLocal);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  const grouped = groupItems(items);

  const openItem = async (item: AppNotification) => {
    if (!item.isRead) {
      markReadLocal(item.id);
      try {
        await notificationsApi.markRead(item.id);
      } catch {
        /* optimistic */
      }
    }
    router.push(item.actionRoute);
  };

  if (isLoading && items.length === 0) {
    return <PageLoader variant="list" />;
  }

  return (
    <SettingsPageShell narrow>
      <SettingsBackHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        icon={<Bell className="h-5 w-5 text-[#FF2E74]" />}
        action={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-white/10 bg-white/5 text-xs"
              onClick={async () => {
                markAllReadLocal();
                try {
                  await notificationsApi.markAllRead();
                } catch {
                  /* optimistic */
                }
              }}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <NotificationEmptyState />
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key}>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B78]">
                {GROUP_LABELS[group.key]}
              </p>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      'w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-200 sm:px-4 sm:py-3.5',
                      'hover:border-white/15 hover:bg-white/[0.03]',
                      item.isRead
                        ? 'border-white/6 bg-[#17171C]/70'
                        : cn('bg-[#1B1B22]/90', priorityAccentBorder(item.priority, false)),
                    )}
                  >
                    <div className="flex gap-3">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/10 sm:h-10 sm:w-10 sm:rounded-xl"
                        />
                      ) : (
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl',
                            notificationIconClass(item.type),
                          )}
                        >
                          <NotificationIcon type={item.type} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-white sm:text-[15px]">
                            {item.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            {item.priority !== 'normal' && (
                              <span
                                className={cn(
                                  'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                                  priorityBadgeClass(item.priority),
                                )}
                              >
                                {item.priorityLabel ?? item.priority}
                              </span>
                            )}
                            {!item.isRead && (
                              <span className="mt-0.5 h-2 w-2 rounded-full bg-[#FF2E74]" />
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#A7A7B3] sm:text-sm">
                          {item.message}
                        </p>
                        <p className="mt-1.5 text-[11px] text-[#6B6B78]">
                          {formatTimeAgo(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full border-white/10"
              onClick={() => void fetchMore()}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </SettingsPageShell>
  );
}
