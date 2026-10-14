import { hashPassword, verifyPassword } from './password';
describe('Native password storage', () => {
  it('salts every hash and verifies without storing plaintext', async () => {
    const password = 'a long test passphrase';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong password', first)).toBe(false);
  });
  it('rejects malformed or attacker-controlled cost parameters', async () => {
    expect(await verifyPassword('test', 'scrypt$99999999$8$3$salt$hash')).toBe(false);
    expect(await verifyPassword('test', '')).toBe(false);
  });
});
