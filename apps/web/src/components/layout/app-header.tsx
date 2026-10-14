'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand/brand-logo';
import { WalletBadge } from '@/components/wallet/wallet-badge';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useIsHostRole } from '@/hooks/use-is-host-role';
import { getHomeHref } from '@/stores/role-mode-store';

type AppHeaderProps = {
  className?: string;
  sticky?: boolean;
};

/**
 * Desktop center navigation (user accounts).
 * ONLY Discover · Favorites · Wallet — Audio/Video stay available via Discover/host UI.
 */
const desktopUserNav = [
  { href: '/home', label: 'Discover' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/wallet', label: 'Wallet' },
] as const;

/**
 * Desktop center navigation (host accounts).
 * History is not a primary nav item — access via Withdraw → Withdrawal History.
 */
const desktopHostNav = [
  { href: '/host/dashboard', label: 'Home' },
  { href: '/host/earnings', label: 'Earnings' },
  { href: '/host/withdraw', label: 'Withdraw' },
  { href: '/settings', label: 'Profile' },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/home') return pathname === '/home' || pathname.startsWith('/home/');
  if (href === '/host/dashboard') {
    return pathname === '/host/dashboard' || pathname.startsWith('/host/dashboard/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Global authenticated header.
 * Nav is driven by authenticated roles (host vs user) — no client role switch.
 * Desktop: large logo · center nav · notifications / coins / profile
 * Mobile: compact logo · right controls (bottom nav in AppShell)
 */
export function AppHeader({ className, sticky = true }: AppHeaderProps) {
  const pathname = usePathname();
  const isHost = useIsHostRole();
  const homeHref = getHomeHref(isHost);
  const navItems = isHost ? desktopHostNav : desktopUserNav;

  return (
    <header
      className={cn(
        'z-40 w-full shrink-0 border-b border-white/8 bg-[#0F0F12]/92 backdrop-blur-xl',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:h-[76px] sm:px-6 lg:h-[84px] lg:px-10 xl:px-12">
        {/* LEFT — official logo (premium scale) */}
        <div className="flex min-w-0 shrink-0 items-center">
          <BrandLogo href={homeHref} size="md" />
        </div>

        {/* CENTER — desktop navigation */}
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:gap-2"
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-full px-4 py-2.5 text-base font-medium transition-colors duration-200 xl:px-5 xl:text-[17px]',
                  active
                    ? 'bg-white/8 text-white shadow-sm ring-1 ring-white/10'
                    : 'text-[#A7A7B3] hover:bg-white/5 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT — notifications, coins (users only), profile */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <NotificationBell />
          {!isHost && <WalletBadge />}
          <Link
            href="/settings"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#A7A7B3] transition-all duration-200 hover:border-white/20 hover:bg-white/8 hover:text-white"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Alias for call sites that prefer a mobile-oriented name. */
export const MobileHeader = AppHeader;
