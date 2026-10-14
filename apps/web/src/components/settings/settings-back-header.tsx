'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type SettingsBackHeaderProps = {
  title: string;
  subtitle?: string;
  /** Defaults to /settings */
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
};

/**
 * Consistent subpage header for settings-related routes.
 * Always shows a visible "← Settings" (or custom) back control.
 */
export function SettingsBackHeader({
  title,
  subtitle,
  backHref = '/settings',
  backLabel = 'Settings',
  action,
  className,
  icon,
}: SettingsBackHeaderProps) {
  return (
    <header className={cn('mb-6 space-y-4 sm:mb-8', className)}>
      <Link
        href={backHref}
        className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-[#A7A7B3] transition-colors hover:border-white/20 hover:bg-white/8 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        {backLabel}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-[#A7A7B3] sm:text-base">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
    </header>
  );
}
