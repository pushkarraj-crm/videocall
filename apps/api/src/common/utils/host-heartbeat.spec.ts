import {
  HOST_HEARTBEAT_STALE_MS,
  heartbeatStaleCutoff,
  isHeartbeatFresh,
} from './host-heartbeat';

describe('host-heartbeat', () => {
  const now = new Date('2026-06-29T12:00:00.000Z');

  it('treats recent beats as fresh', () => {
    const beat = new Date(now.getTime() - 10_000);
    expect(isHeartbeatFresh(beat, now)).toBe(true);
  });

  it('treats stale beats as offline', () => {
    const beat = new Date(now.getTime() - HOST_HEARTBEAT_STALE_MS - 1);
    expect(isHeartbeatFresh(beat, now)).toBe(false);
  });

  it('computes stale cutoff', () => {
    expect(heartbeatStaleCutoff(now).getTime()).toBe(now.getTime() - HOST_HEARTBEAT_STALE_MS);
  });
});