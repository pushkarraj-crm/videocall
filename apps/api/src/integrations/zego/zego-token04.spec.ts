import { buildRtcRoomPayload, generateToken04, toZegoUserId } from './zego-token04';

describe('generateToken04', () => {
  const secret = '0123456789abcdef0123456789abcdef';

  it('produces official Token04 format', () => {
    const token = generateToken04(
      123456789,
      'user-1',
      secret,
      3600,
      buildRtcRoomPayload('room_test'),
    );

    expect(token.startsWith('04')).toBe(true);
    expect(token).not.toContain('.');
  });

  it('accepts UUID user ids', () => {
    const token = generateToken04(
      1009856996,
      '05f869ea-a1a4-4f0f-9ff6-211fbcbef4ef',
      secret,
      3600,
      '',
    );
    expect(token.startsWith('04')).toBe(true);
    expect(token.length).toBeGreaterThan(100);
  });

  it('toZegoUserId preserves UUID', () => {
    const id = '05f869ea-a1a4-4f0f-9ff6-211fbcbef4ef';
    expect(toZegoUserId(id)).toBe(id);
  });
});