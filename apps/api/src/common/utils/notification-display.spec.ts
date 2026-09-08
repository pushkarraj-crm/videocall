import {
  NotificationPriority,
  NotificationReferenceType,
  NotificationType,
} from '@prisma/client';
import {
  notificationActionRoute,
  priorityLabel,
  resolveReferenceType,
  resolveTimeGroup,
  supportsBrowserPush,
} from './notification-display';

describe('notification-display', () => {
  it('maps incoming call to incoming screen', () => {
    expect(notificationActionRoute(NotificationType.incoming_call)).toBe('/calls/incoming');
  });

  it('maps recharge to wallet', () => {
    expect(notificationActionRoute(NotificationType.recharge_success)).toBe('/wallet');
    expect(notificationActionRoute(NotificationType.recharge_failed)).toBe('/wallet');
  });

  it('maps host withdrawal to withdraw page', () => {
    expect(notificationActionRoute(NotificationType.withdrawal_approved)).toBe('/host/withdraw');
  });

  it('resolves reference types', () => {
    expect(resolveReferenceType(NotificationType.incoming_call)).toBe(
      NotificationReferenceType.CALL,
    );
    expect(resolveReferenceType(NotificationType.recharge_failed)).toBe(
      NotificationReferenceType.RECHARGE,
    );
    expect(resolveReferenceType(NotificationType.admin_announcement)).toBe(
      NotificationReferenceType.SYSTEM,
    );
  });

  it('maps priority labels for production scale', () => {
    expect(priorityLabel(NotificationPriority.low)).toBe('LOW');
    expect(priorityLabel(NotificationPriority.normal)).toBe('NORMAL');
    expect(priorityLabel(NotificationPriority.high)).toBe('HIGH');
    expect(priorityLabel(NotificationPriority.urgent)).toBe('URGENT');
  });

  it('groups today and yesterday', () => {
    const now = new Date('2026-06-25T15:00:00Z');
    expect(resolveTimeGroup(new Date('2026-06-25T10:00:00Z'), now)).toBe('today');
    expect(resolveTimeGroup(new Date('2026-06-24T10:00:00Z'), now)).toBe('yesterday');
    expect(resolveTimeGroup(new Date('2026-06-20T10:00:00Z'), now)).toBe('earlier');
  });

  it('identifies browser push types', () => {
    expect(supportsBrowserPush(NotificationType.incoming_call)).toBe(true);
    expect(supportsBrowserPush(NotificationType.admin_announcement)).toBe(true);
    expect(supportsBrowserPush(NotificationType.call_rejected)).toBe(false);
    expect(supportsBrowserPush(NotificationType.recharge_failed)).toBe(false);
  });

  it('respects audience metadata for call history route', () => {
    expect(
      notificationActionRoute(NotificationType.missed_call, { audience: 'host' }),
    ).toBe('/host/history');
    expect(notificationActionRoute(NotificationType.missed_call)).toBe('/history');
  });
});