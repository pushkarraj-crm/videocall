'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  Wallet,
  User,
  TrendingUp,
  Home,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/components/layout/app-header';
import { useNotificationsStore } from '@/stores/notifications-store';
import { useIncomingCalls } from '@/hooks/use-incoming-calls';
import { useNotifications } from '@/hooks/use-notifications';
import { useIsHostRole } from '@/hooks/use-is-host-role';
import { getHomeHref } from '@/stores/role-mode-store';

const NotificationDrawer = dynamic(
  () => import('@/components/notifications/notification-drawer').then((m) => m.NotificationDrawer),
  { ssr: false },
);

/**
 * Mobile bottom nav — user accounts.
 * Mirrors desktop primary nav (Discover / Favorites / Wallet) + Profile access.
 */
const userNavItems = [
  { href: '/home', icon: Compass, label: 'Discover' },
  { href: '/favorites', icon: Heart, label: 'Favorites' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/settings', icon: User, label: 'Profile' },
] as const;

/** Mobile bottom nav — host accounts (no separate History item) */
const hostNavItems = [
  { key: 'home', icon: Home, label: 'Home' },
  { href: '/host/earnings', icon: TrendingUp, label: 'Earnings' },
  { href: '/host/withdraw', icon: Wallet, label: 'Withdraw' },
  { href: '/settings', icon: User, label: 'Profile' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNav = pathname.startsWith('/calls/');
  const isHost = useIsHostRole();
  const homeHref = getHomeHref(isHost);
  const navItems = isHost ? hostNavItems : userNavItems;
  const drawerOpen = useNotificationsStore((s) => s.drawerOpen);
  const [drawerLoaded, setDrawerLoaded] = useState(false);
  useEffect(() => {
    if (drawerOpen) setDrawerLoaded(true);
  }, [drawerOpen]);
  useIncomingCalls();
  useNotifications();

  // Host accounts should not use the user wallet purchase flow as primary surface.
  useEffect(() => {
    if (!isHost) return;
    if (pathname === '/wallet/history') return;
    if (pathname.startsWith('/wallet') || pathname === '/referrals') {
      router.replace('/host/earnings');
    }
  }, [isHost, pathname, router]);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#0F0F12]">
      {!hideNav && <AppHeader />}
      <main className="mx-auto w-full max-w-[1600px] flex-1">{children}</main>
      {(drawerOpen || drawerLoaded) && <NotificationDrawer />}
      {/* Bottom nav: mobile / tablet only — desktop uses AppHeader nav */}
      {!hideNav && (
        <nav
          className="sticky bottom-0 z-40 border-t border-white/8 bg-[#0F0F12]/95 backdrop-blur-xl safe-area-pb lg:hidden"
          aria-label="Mobile"
        >
          <div className="flex items-center justify-around px-1 py-2">
            {navItems.map((item) => {
              const href = 'key' in item ? homeHref : item.href;
              const active = pathname.startsWith(href);
              const Icon = item.icon;
              const label = item.label;

              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    'press-scale flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] transition-colors duration-200 sm:px-2',
                    active ? 'text-[#FF2E74]' : 'text-[#A7A7B3] hover:text-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
                      active && 'gradient-primary text-white nav-active-glow',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="max-w-[4.5rem] truncate text-center">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
