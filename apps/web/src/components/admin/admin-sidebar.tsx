'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Mic,
  CreditCard,
  Wallet,
  Bot,
  BarChart3,
  IndianRupee,
  LogOut,
  User,
  Route,
  Settings,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/hosts', icon: Mic, label: 'Hosts' },
  { href: '/admin/ai-hosts', icon: Bot, label: 'AI Hosts' },
  { href: '/admin/settings/call-routing', icon: Route, label: 'Call Routing' },
  { href: '/admin/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { href: '/admin/withdrawals', icon: IndianRupee, label: 'Withdrawals' },
  { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/8 bg-[#17171C] md:flex">
      <div className="space-y-1 border-b p-4">
        <BrandLogo href="/admin" size="sm" />
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Admin Panel</p>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {links.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href ||
            (href !== '/admin' && href !== '/admin/settings' && pathname.startsWith(`${href}/`)) ||
            (href === '/admin/settings' && pathname.startsWith('/admin/settings') && pathname !== '/admin/settings/call-routing');

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'gradient-primary text-white nav-active-glow'
                  : 'text-[#A7A7B3] hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatarUrl ?? undefined} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.displayName ?? 'Admin'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.phone ?? profile?.email ?? 'Administrator'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full cursor-pointer"
          onClick={() => {
            // Explicit string path only — never pass the click event to logout().
            logout('/admin/login');
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}