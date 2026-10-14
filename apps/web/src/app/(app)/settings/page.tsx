'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LogOut,
  User,
  Bell,
  Mail,
  Shield,
  Mic,
  Moon,
  Gift,
  Trophy,
  Pencil,
} from 'lucide-react';
import { giftsApi } from '@/lib/api/gifts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from 'next-themes';
import { SettingsGroup, SettingsRow } from '@/components/shared/settings-row';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';

export default function SettingsPage() {
  const { profile, logout, isHost } = useAuth();
  const { theme, setTheme } = useTheme();
  const [giftStats, setGiftStats] = useState<Awaited<
    ReturnType<typeof giftsApi.myStats>
  > | null>(null);

  useEffect(() => {
    giftsApi.myStats().then(setGiftStats).catch(() => setGiftStats(null));
  }, []);

  const accountLinks = [
    {
      href: '/notifications',
      icon: Bell,
      label: 'Notifications',
      description: 'View and manage your alerts',
    },
    {
      href: '/settings/notifications',
      icon: Bell,
      label: 'Notification Settings',
      description: 'Control what you receive',
    },
    {
      href: '/settings/communication',
      icon: Mail,
      label: 'Email & SMS Settings',
      description: 'Marketing and transactional messages',
    },
    {
      href: '/reports',
      icon: Shield,
      label: 'Safety & Reports',
      description: 'Help keep the community safe',
    },
    {
      href: '/invite',
      icon: User,
      label: 'Invite Friends',
      description: 'Share your invite and earn rewards',
    },
  ] as const;

  const extraLinks = [
    {
      href: '/history/gifts',
      icon: Gift,
      label: 'Gift History',
      description: 'Gifts you have sent',
    },
    {
      href: '/gifts/leaderboard',
      icon: Trophy,
      label: 'Gift Leaderboard',
      description: 'Top gifters on the platform',
    },
    ...(isHost
      ? [
          {
            href: '/host/dashboard',
            icon: Mic,
            label: 'Host Dashboard',
            description: 'Manage availability and earnings',
          },
        ]
      : [
          {
            href: '/become-host',
            icon: Mic,
            label: 'Become a Host',
            description: 'Start earning from live calls',
          },
        ]),
  ] as const;

  return (
    <SettingsPageShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[#A7A7B3] sm:text-base">
          Manage your profile, preferences, and account
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6 xl:gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5 lg:space-y-6">
          {/* Profile header card */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] sm:p-5">
            <div className="flex items-center gap-4 sm:gap-5">
              <Avatar className="h-14 w-14 shrink-0 border-2 border-white/10 ring-2 ring-[#FF2E74]/25 sm:h-16 sm:w-16">
                <AvatarImage src={profile?.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-[#FF2E74]/20 text-lg font-bold text-white">
                  {profile?.displayName?.[0] ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-white sm:text-xl">
                  {profile?.displayName ?? 'User'}
                </h2>
                <p className="mt-0.5 truncate text-sm text-[#A7A7B3]">
                  {profile?.phone ?? profile?.email ?? '—'}
                </p>
                {profile?.bio && (
                  <p className="mt-1 line-clamp-2 text-xs text-[#A7A7B3]/90">{profile.bio}</p>
                )}
              </div>
            </div>
            <Button
              className="mt-4 h-11 w-full cursor-pointer border-0 gradient-primary sm:w-auto"
              asChild
            >
              <Link href="/settings/profile">
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
          </div>

          {/* Gift activity */}
          {giftStats && giftStats.totalGiftsSent > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] sm:p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF2E74]/15">
                  <Gift className="h-4 w-4 text-[#FF2E74]" />
                </span>
                Gift activity
              </div>
              <p className="text-sm text-[#A7A7B3]">
                {giftStats.totalGiftsSent} sent · {giftStats.totalCoinsSpent} coins total
              </p>
              {giftStats.favoriteGift && (
                <p className="mt-1 text-sm text-[#A7A7B3]">
                  Favorite: {giftStats.favoriteGift.icon} {giftStats.favoriteGift.name}
                </p>
              )}
              <Link
                href="/history/gifts"
                className="mt-3 inline-flex text-sm font-medium text-[#FF6B9D] transition-colors hover:text-[#FF8AB0]"
              >
                View gift history →
              </Link>
            </div>
          )}

          {/* Preferences */}
          <SettingsGroup title="Preferences">
            <SettingsRow
              icon={Moon}
              label="Dark mode"
              description="Premium dark theme"
              switchChecked={theme === 'dark'}
              onSwitchChange={(v) => setTheme(v ? 'dark' : 'light')}
            />
          </SettingsGroup>

          {/* Extra links on left for balance on large screens */}
          <SettingsGroup title="More">
            {extraLinks.map(({ href, icon, label, description }) => (
              <SettingsRow
                key={href}
                href={href}
                icon={icon}
                label={label}
                description={description}
              />
            ))}
          </SettingsGroup>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5 lg:space-y-6">
          <SettingsGroup title="Account">
            {accountLinks.map(({ href, icon, label, description }) => (
              <SettingsRow
                key={href}
                href={href}
                icon={icon}
                label={label}
                description={description}
              />
            ))}
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
              icon={LogOut}
              label="Log out"
              description="Sign out of this device"
              destructive
              onClick={() => logout(isHost ? '/host/login' : '/login')}
            />
          </SettingsGroup>

          <p className="text-center text-xs text-[#A7A7B3]/50 lg:text-left">
            <Link href="/legal/privacy" className="hover:text-[#A7A7B3]">
              Privacy
            </Link>
            {' · '}
            <Link href="/legal/terms" className="hover:text-[#A7A7B3]">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </SettingsPageShell>
  );
}
