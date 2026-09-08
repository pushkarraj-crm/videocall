import { CallEndReason, CallHistoryStatus, CallStatus } from '@prisma/client';
import { historyDisplayStatus, mapCallToHistoryStatus } from './call-history-display';

describe('mapCallToHistoryStatus', () => {
  it('maps rejected calls', () => {
    expect(
      mapCallToHistoryStatus(CallStatus.rejected, null, null),
    ).toBe(CallHistoryStatus.rejected);
  });

  it('maps completed ended calls', () => {
    expect(
      mapCallToHistoryStatus(CallStatus.ended, CallEndReason.user_ended, new Date()),
    ).toBe(CallHistoryStatus.completed);
  });

  it('maps cancelled pre-answer calls', () => {
    expect(
      mapCallToHistoryStatus(CallStatus.ended, CallEndReason.user_ended, null),
    ).toBe(CallHistoryStatus.cancelled);
  });

  it('maps network failures', () => {
    expect(
      mapCallToHistoryStatus(CallStatus.ended, CallEndReason.network_error, new Date()),
    ).toBe(CallHistoryStatus.failed);
  });
});

describe('historyDisplayStatus', () => {
  it('returns display labels', () => {
    expect(historyDisplayStatus(CallHistoryStatus.completed)).toBe('COMPLETED');
    expect(historyDisplayStatus(CallHistoryStatus.missed)).toBe('MISSED');
  });
});