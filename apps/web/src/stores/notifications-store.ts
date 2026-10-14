'use client';

import { create } from 'zustand';
import type { AppNotification } from '@/types/notifications';
import { notificationsApi } from '@/lib/api/notifications';

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  badgePulse: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  pulseBadge: () => void;
  fetchInitial: () => Promise<void>;
  fetchMore: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  prependNotification: (notification: AppNotification) => void;
  markReadLocal: (id: string) => void;
  markAllReadLocal: () => void;
  removeLocal: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  badgePulse: false,
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  nextCursor: null,
  drawerOpen: false,

  setDrawerOpen: (open) => set({ drawerOpen: open }),

  pulseBadge: () => {
    set({ badgePulse: true });
    setTimeout(() => set({ badgePulse: false }), 700);
  },

  fetchInitial: async () => {
    set({ isLoading: true });
    try {
      const [list, unread] = await Promise.all([
        notificationsApi.list({ limit: 20 }),
        notificationsApi.unreadCount(),
      ]);
      set({
        items: list.items,
        hasMore: list.hasMore,
        nextCursor: list.nextCursor,
        unreadCount: unread.count,
      });
    } catch {
      /* keep last known state */
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMore: async () => {
    const { nextCursor, hasMore, isLoadingMore } = get();
    if (!hasMore || !nextCursor || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const list = await notificationsApi.list({ cursor: nextCursor, limit: 20 });
      set((state) => ({
        items: [...state.items, ...list.items],
        hasMore: list.hasMore,
        nextCursor: list.nextCursor,
      }));
    } catch {
      /* ignore */
    } finally {
      set({ isLoadingMore: false });
    }
  },

  setUnreadCount: (count) => set({ unreadCount: count }),

  prependNotification: (notification) => {
    set((state) => ({
      items: [
        notification,
        ...state.items.filter((item) => item.id !== notification.id),
      ].slice(0, 100),
      unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
    }));
    if (!notification.isRead) {
      get().pulseBadge();
    }
  },

  markReadLocal: (id) =>
    set((state) => {
      const target = state.items.find((item) => item.id === id);
      if (!target || target.isRead) return state;
      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),

  markAllReadLocal: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
    })),

  removeLocal: (id) =>
    set((state) => {
      const target = state.items.find((item) => item.id === id);
      return {
        items: state.items.filter((item) => item.id !== id),
        unreadCount:
          target && !target.isRead
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
      };
    }),
}));