import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { GoogleAuthController } from './google-auth.controller';
import { NativeAuthService } from './native-auth.service';
import { OAuth2Client } from 'google-auth-library';

describe('Google OAuth boundary', () => {
  const config = new ConfigService({ GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret', WEB_URL: 'http://localhost:3000' });
  const jwt = new JwtService({ secret: 'test-secret-only-not-a-production-key' });
  const native = { googleLogin: jest.fn() };
  const controller = new GoogleAuthController(config, jwt, native as unknown as NativeAuthService);
  afterEach(() => { jest.restoreAllMocks(); native.googleLogin.mockReset(); });
  it('uses PKCE, nonce, a signed HttpOnly state cookie and limited scopes', async () => {
    const res = { cookie: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() };
    await controller.start('host', res as unknown as Response);
    const url = new URL(res.redirect.mock.calls[0][0] as string);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    const cookie = res.cookie.mock.calls[0];
    expect(cookie[2]).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    expect((await jwt.verifyAsync(cookie[1] as string)).intent).toBe('host');
  });
  it('rejects an absent state cookie without exchanging an authorization code', async () => {
    const res = { clearCookie: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() };
    await controller.callback({ headers: {}, query: { code: 'untrusted' } } as unknown as Request, res as unknown as Response);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/login/google#error=google');
    expect(native.googleLogin).not.toHaveBeenCalled();
  });
  it('rejects mismatched state', async () => {
    const cookie = await jwt.signAsync({ purpose: 'google_oauth', state: 'a'.repeat(64), nonce: 'nonce', verifier: 'verifier', intent: 'user' });
    const res = { clearCookie: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() };
    await controller.callback({ headers: { cookie: `platform_google_oauth=${cookie}` }, query: { code: 'untrusted', state: 'b'.repeat(64) } } as unknown as Request, res as unknown as Response);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/login/google#error=google');
    expect(native.googleLogin).not.toHaveBeenCalled();
  });
  it('verifies audience and nonce before issuing a one-time session handoff', async () => {
    const state = 'a'.repeat(64);
    const nonce = 'n'.repeat(64);
    const cookie = await jwt.signAsync({ purpose: 'google_oauth', state, nonce, verifier: 'saved-verifier', intent: 'host' });
    const exchange = jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'google-id-token' } } as never);
    const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'subject', email: 'verified@example.invalid', email_verified: true, nonce, name: 'Verified' }) } as never);
    native.googleLogin.mockResolvedValue('c'.repeat(64));
    const res = { clearCookie: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() };
    await controller.callback({ headers: { cookie: `platform_google_oauth=${cookie}` }, query: { code: 'authorization-code', state } } as unknown as Request, res as unknown as Response);
    expect(exchange).toHaveBeenCalledWith({ code: 'authorization-code', codeVerifier: 'saved-verifier' });
    expect(verify).toHaveBeenCalledWith({ idToken: 'google-id-token', audience: 'test.apps.googleusercontent.com' });
    expect(native.googleLogin).toHaveBeenCalledWith('subject', 'verified@example.invalid', 'Verified', 'host');
    expect(res.redirect).toHaveBeenCalledWith(`http://localhost:3000/login/google#code=${'c'.repeat(64)}`);
  });
  it('rejects unverified Google email even when token verification succeeds', async () => {
    const state = 'a'.repeat(64);
    const cookie = await jwt.signAsync({ purpose: 'google_oauth', state, nonce: 'nonce', verifier: 'verifier', intent: 'user' });
    jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'google-id-token' } } as never);
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'subject', email: 'unverified@example.invalid', email_verified: false, nonce: 'nonce' }) } as never);
    const res = { clearCookie: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() };
    await controller.callback({ headers: { cookie: `platform_google_oauth=${cookie}` }, query: { code: 'code', state } } as unknown as Request, res as unknown as Response);
    expect(native.googleLogin).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/login/google#error=google');
  });
});
