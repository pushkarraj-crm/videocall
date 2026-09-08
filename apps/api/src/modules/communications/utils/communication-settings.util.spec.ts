import { CommunicationEventType } from '@prisma/client';
import {
  canSendEmail,
  canSendSms,
  defaultCommunicationSettings,
} from './communication-settings.util';

describe('communication-settings.util', () => {
  const prefs = defaultCommunicationSettings();

  it('always allows security email', () => {
    expect(canSendEmail(CommunicationEventType.otp_verification, {
      ...prefs,
      marketingEmails: false,
      transactionalEmails: false,
    })).toBe(true);
  });

  it('always allows security sms', () => {
    expect(canSendSms(CommunicationEventType.security_alert, {
      ...prefs,
      transactionalSms: false,
      marketingSms: false,
    })).toBe(true);
  });

  it('respects marketing email preference', () => {
    expect(
      canSendEmail(CommunicationEventType.welcome_email, {
        ...prefs,
        marketingEmails: false,
      }),
    ).toBe(false);
  });

  it('respects marketing sms preference', () => {
    expect(
      canSendSms(CommunicationEventType.welcome_email, {
        ...prefs,
        marketingSms: false,
      }),
    ).toBe(false);
  });

  it('respects promotion sms preference', () => {
    expect(
      canSendSms(CommunicationEventType.coupon_available, {
        ...prefs,
        promotionSms: false,
      }),
    ).toBe(false);
  });

  it('respects transactional sms preference', () => {
    expect(
      canSendSms(CommunicationEventType.recharge_success, {
        ...prefs,
        transactionalSms: false,
      }),
    ).toBe(false);
  });
});