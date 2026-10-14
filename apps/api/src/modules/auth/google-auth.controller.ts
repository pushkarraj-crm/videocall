import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { BusinessException } from '../../common/exceptions/business.exception';
import { NativeAuthService } from './native-auth.service';

type GoogleState = { purpose: string; state: string; nonce: string; verifier: string; intent: string };
@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService, private readonly nativeAuth: NativeAuthService) {}
  private client() {
    const id = this.config.get<string>('GOOGLE_CLIENT_ID');
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirect = this.config.get<string>('GOOGLE_CALLBACK_URL', 'http://localhost:3001/v1/auth/google/callback');
    if (!id || !secret) throw new BusinessException('Google login is not configured yet. Please use email or phone.', 503, 'GOOGLE_NOT_CONFIGURED');
    return new OAuth2Client(id, secret, redirect);
  }
  private cookieOptions() {
    return { httpOnly: true, secure: this.config.get('NODE_ENV') === 'production', sameSite: 'lax' as const, path: `/${this.config.get('API_PREFIX', 'v1')}/auth/google`, maxAge: 10 * 60_000 };
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('start')
  async start(@Query('intent') intent: string = 'user', @Res() res: Response) {
    const client = this.client();
    if (!['user', 'host', 'admin'].includes(intent)) throw new BusinessException('Invalid login intent', 400, 'INVALID_INTENT');
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(32).toString('hex');
    const verifier = randomBytes(48).toString('base64url');
    res.cookie('platform_google_oauth', await this.jwt.signAsync({ purpose: 'google_oauth', state, nonce, verifier, intent }, { expiresIn: '10m' }), this.cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: CodeChallengeMethod.S256, access_type: 'online', prompt: 'select_account' }));
  }
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const destination = `${this.config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '')}/login/google`;
    res.clearCookie('platform_google_oauth', this.cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    try {
      const cookie = req.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith('platform_google_oauth='))?.split('=').slice(1).join('=');
      if (!cookie) throw new Error('Missing OAuth state');
      const saved = await this.jwt.verifyAsync<GoogleState>(decodeURIComponent(cookie));
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      if (saved.purpose !== 'google_oauth' || !/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(saved.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) throw new Error('Invalid OAuth state');
      if (typeof req.query.code !== 'string') throw new Error('Missing authorization code');
      const client = this.client();
      const { tokens } = await client.getToken({ code: req.query.code, codeVerifier: saved.verifier });
      if (!tokens.id_token) throw new Error('Missing Google ID token');
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID') });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || !payload.email_verified || (payload as typeof payload & { nonce?: string }).nonce !== saved.nonce) throw new Error('Invalid Google identity');
      const code = await this.nativeAuth.googleLogin(payload.sub, payload.email.trim().toLowerCase(), payload.name ?? payload.email.split('@')[0], saved.intent);
      return res.redirect(`${destination}#code=${code}`);
    } catch (error) {
      return res.redirect(`${destination}#error=${error instanceof BusinessException ? 'account' : 'google'}`);
    }
  }
}
