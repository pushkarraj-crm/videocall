export type HostAvailabilityStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export function resolveHostStatus(isOnline: boolean, isBusy: boolean): HostAvailabilityStatus {
  if (!isOnline) return 'OFFLINE';
  if (isBusy) return 'BUSY';
  return 'ONLINE';
}

export function canReceiveCalls(host: {
  canReceiveCalls?: boolean;
  isOnline?: boolean;
  isBusy?: boolean;
  isAvailable?: boolean;
}): boolean {
  if (host.canReceiveCalls !== undefined) return host.canReceiveCalls;
  if (host.isOnline !== undefined) return host.isOnline && !host.isBusy;
  return host.isAvailable ?? false;
}

export function formatLastSeenLabel(
  lastSeenAt: string | null | undefined,
  isOnline: boolean,
  isBusy: boolean,
): string {
  if (isOnline && isBusy) return 'Busy';
  if (isOnline) return 'Online';
  if (!lastSeenAt) return 'Offline';

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Last seen just now';
  if (diffMin < 60) return `Last seen ${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? 'Last seen 1 hour ago' : `Last seen ${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? 'Last seen 1 day ago' : `Last seen ${diffDays} days ago`;
}

export const HOST_STATUS_STYLES: Record<
  HostAvailabilityStatus,
  { badge: string; dot: string; label: string }
> = {
  ONLINE: {
    badge: 'bg-emerald-500/15 text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'Online',
  },
  BUSY: {
    badge: 'bg-amber-500/15 text-amber-400',
    dot: 'bg-amber-400',
    label: 'Busy',
  },
  OFFLINE: {
    badge: 'bg-white/10 text-[#A7A7B3]',
    dot: 'bg-[#A7A7B3]',
    label: 'Offline',
  },
};