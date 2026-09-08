import {
  canReceiveCalls,
  formatLastSeenLabel,
  resolveHostStatus,
} from './host-status';

describe('resolveHostStatus', () => {
  it('returns OFFLINE when not online', () => {
    expect(resolveHostStatus(false, false)).toBe('OFFLINE');
    expect(resolveHostStatus(false, true)).toBe('OFFLINE');
  });

  it('returns BUSY when online and busy', () => {
    expect(resolveHostStatus(true, true)).toBe('BUSY');
  });

  it('returns ONLINE when online and not busy', () => {
    expect(resolveHostStatus(true, false)).toBe('ONLINE');
  });
});

describe('canReceiveCalls', () => {
  it('allows calls only when online and not busy', () => {
    expect(canReceiveCalls(true, false)).toBe(true);
    expect(canReceiveCalls(true, true)).toBe(false);
    expect(canReceiveCalls(false, false)).toBe(false);
  });
});

describe('formatLastSeenLabel', () => {
  const now = new Date('2026-06-25T12:00:00Z');

  it('shows Online and Busy states', () => {
    expect(formatLastSeenLabel(null, true, false, now)).toBe('Online');
    expect(formatLastSeenLabel(null, true, true, now)).toBe('Busy');
  });

  it('formats relative last seen', () => {
    expect(
      formatLastSeenLabel(new Date('2026-06-25T11:58:00Z'), false, false, now),
    ).toBe('Last seen 2 min ago');
    expect(
      formatLastSeenLabel(new Date('2026-06-25T11:00:00Z'), false, false, now),
    ).toBe('Last seen 1 hour ago');
  });
});