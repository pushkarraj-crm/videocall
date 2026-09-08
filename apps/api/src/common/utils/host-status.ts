export type HostAvailabilityStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export function resolveHostStatus(isOnline: boolean, isBusy: boolean): HostAvailabilityStatus {
  if (!isOnline) return 'OFFLINE';
  if (isBusy) return 'BUSY';
  return 'ONLINE';
}

export function canReceiveCalls(isOnline: boolean, isBusy: boolean): boolean {
  return isOnline && !isBusy;
}

export function formatLastSeenLabel(
  lastSeenAt: Date | null | undefined,
  isOnline: boolean,
  isBusy: boolean,
  now = new Date(),
): string {
  if (isOnline && isBusy) return 'Busy';
  if (isOnline) return 'Online';

  if (!lastSeenAt) return 'Offline';

  const diffMs = now.getTime() - lastSeenAt.getTime();
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