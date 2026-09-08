import { isDisposableEmail } from './disposable-email';

describe('disposable-email', () => {
  it('detects known disposable domains', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
    expect(isDisposableEmail('user@yopmail.com')).toBe(true);
  });

  it('allows legitimate domains', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
    expect(isDisposableEmail('host@company.co.in')).toBe(false);
  });

  it('handles missing email', () => {
    expect(isDisposableEmail(null)).toBe(false);
    expect(isDisposableEmail(undefined)).toBe(false);
    expect(isDisposableEmail('')).toBe(false);
  });
});