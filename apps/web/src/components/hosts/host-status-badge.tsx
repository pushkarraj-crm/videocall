'use client';

import { cn } from '@/lib/utils';
import {
  HOST_STATUS_STYLES,
  resolveHostStatus,
  type HostAvailabilityStatus,
} from '@/lib/host-status';

interface HostStatusBadgeProps {
  isOnline?: boolean;
  isBusy?: boolean;
  status?: HostAvailabilityStatus;
  lastSeenLabel?: string;
  compact?: boolean;
  className?: string;
}

export function HostStatusBadge({
  isOnline = false,
  isBusy = false,
  status,
  lastSeenLabel,
  compact = false,
  className,
}: HostStatusBadgeProps) {
  const resolved = status ?? resolveHostStatus(isOnline, isBusy);
  const styles = HOST_STATUS_STYLES[resolved];
  const subtitle =
    lastSeenLabel ??
    (resolved === 'OFFLINE' ? 'Offline' : resolved === 'BUSY' ? 'Busy' : 'Online');

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium backdrop-blur-md',
          styles.badge,
          className,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot, resolved === 'ONLINE' && 'animate-pulse')} />
        {styles.label}
      </span>
    );
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          styles.badge,
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', styles.dot, resolved === 'ONLINE' && 'animate-pulse')} />
        {styles.label}
      </span>
      {resolved === 'OFFLINE' && lastSeenLabel && (
        <p className="text-[10px] text-[#A7A7B3]">{subtitle}</p>
      )}
    </div>
  );
}