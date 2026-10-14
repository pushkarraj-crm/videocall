import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, UserStatus } from '@prisma/client';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { BusinessException } from '../../common/exceptions/business.exception';
import { generateReferralCode } from '../../common/utils/referral-code.util';
import { PrismaService } from '../../database/prisma.service';
import { TwilioSmsProvider } from '../communications/providers/sms/twilio-sms.provider';
import { Msg91SmsProvider } from '../communications/providers/sms/msg91-sms.provider';
import { TextlocalSmsProvider } from '../communications/providers/sms/textlocal-sms.provider';
import { AuthMailService } from './auth-mail.service';
import { AuthService } from './auth.service';
import { LoginDto, PhoneRequestDto, RegisterDto } from './dto/password-auth.dto';
import { hashPassword, verifyPassword } from './password';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class NativeAuthService {
  private readonly logger = new Logger(NativeAuthService.name);
  private readonly dummyPassword = hashPassword(randomBytes(32).toString('hex'));
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: AuthMailService,
    private readonly config: ConfigService,
    private readonly twilio: TwilioSmsProvider,
    private readonly msg91: Msg91SmsProvider,
    private readonly textlocal: TextlocalSmsProvider,
  ) {}

  private active(user: User) {
    if (user.deletedAt || user.status !== UserStatus.active) {
      throw new BusinessException('Account access denied', 403, 'ACCOUNT_BLOCKED');
    }
  }

  methods() {
    return { google: !!(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET')),
      phone: this.config.get('NODE_ENV') !== 'production' || ['msg91', 'twilio', 'textlocal'].includes(this.config.get('SMS_PROVIDER', 'console')) };
  }

  private async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data: {
      roles: { create: { role: 'user' } }, wallet: { create: {} }, ...data,
    } });
  }

  async register(dto: RegisterDto) {
    this.mail.assertAvailable();
    const existing = await this.prisma.user.findFirst({ where: {
      email: { equals: dto.email, mode: 'insensitive' }, deletedAt: null,
    } });
    if (existing) throw new BusinessException('This email already has an account. Sign in or reset your password.', 409, 'EMAIL_IN_USE');
    const passwordHash = await hashPassword(dto.password);
    let user: User;
    try {
      user = await this.createUser({
        authIdentity: `local_${randomUUID()}`, displayName: dto.displayName,
        dateOfBirth: new Date('2000-01-01'), referralCode: generateReferralCode(),
        email: dto.email, credential: { create: { email: dto.email, passwordHash } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BusinessException('This email already has an account. Sign in or reset your password.', 409, 'EMAIL_IN_USE');
      }
      throw error;
    }
    await this.auth.grantSignupBonus(user.id);
    await this.sendRecovery(user, dto.email, 'verify_email').catch(() => this.logger.warn('Verification email could not be delivered; resend is available.'));
    return this.auth.createUserSession(user, 'user', true);
  }

  async login(dto: LoginDto) {
    const credential = await this.prisma.authCredential.findUnique({ where: { email: dto.email }, include: { user: true } });
    const valid = await verifyPassword(dto.password, credential?.passwordHash ?? await this.dummyPassword);
    const locked = credential?.lockedUntil && credential.lockedUntil > new Date();
    if (!credential || !valid || locked) {
      if (credential && !locked) {
        const row = await this.prisma.authCredential.update({ where: { userId: credential.userId }, data: { failedAttempts: { increment: 1 } } });
        if (row.failedAttempts >= 5) await this.prisma.authCredential.update({ where: { userId: credential.userId }, data: { lockedUntil: new Date(Date.now() + 15 * 60_000), failedAttempts: 0 } });
      }
      throw new BusinessException('Email or password is incorrect. If needed, reset your password or try again later.', 401, 'INVALID_CREDENTIALS');
    }
    this.active(credential.user);
    await this.prisma.authCredential.update({ where: { userId: credential.userId }, data: { failedAttempts: 0, lockedUntil: null } });
    return this.auth.createUserSession(credential.user, dto.intent);
  }

  private async sendRecovery(user: User, email: string, purpose: 'reset_password' | 'verify_email') {
    const token = randomBytes(32).toString('hex');
    const record = await this.prisma.authRecoveryToken.create({ data: {
      userId: user.id, email, purpose, tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    } });
    const reset = purpose === 'reset_password';
    try {
      await this.mail.send(email, reset ? 'Reset your Lovenexa password' : 'Verify your Lovenexa email',
        `${reset ? 'Choose a new password' : 'Verify your email'}: ${this.mail.link(reset ? 'reset-password' : 'verify-email', token)}\nThis link expires in 30 minutes. If you did not request it, ignore this email.`);
    } catch (error) {
      await this.prisma.authRecoveryToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      throw error;
    }
  }

  async forgotPassword(email: string) {
    this.mail.assertAvailable();
    const credential = await this.prisma.authCredential.findUnique({ where: { email }, include: { user: true } });
    const legacy = credential ? [] : await this.prisma.user.findMany({ where: {
      email: { equals: email, mode: 'insensitive' }, deletedAt: null,
    }, take: 2 });
    const user = credential?.user ?? (legacy.length === 1 ? legacy[0] : undefined);
    if (user && !user.deletedAt && user.status === 'active') {
      await this.sendRecovery(user, email, 'reset_password').catch(() => this.logger.warn('Password recovery delivery failed.'));
    }
    return { message: 'If an account exists for that email, a reset link will be sent.' };
  }

  async resendVerification(userId: string) {
    this.mail.assertAvailable();
    const credential = await this.prisma.authCredential.findUnique({ where: { userId }, include: { user: true } });
    if (credential && !credential.emailVerifiedAt) await this.sendRecovery(credential.user, credential.email, 'verify_email');
    return { message: 'Check your inbox for an email verification link.' };
  }

  private async consumeRecovery(tx: Prisma.TransactionClient, token: string, purpose: string) {
    const record = await tx.authRecoveryToken.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
    if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt <= new Date()) {
      throw new BusinessException('This link is invalid or expired. Request a new one.', 400, 'INVALID_RECOVERY_TOKEN');
    }
    this.active(record.user);
    const claimed = await tx.authRecoveryToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new BusinessException('This link has already been used.', 400, 'INVALID_RECOVERY_TOKEN');
    return record;
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const record = await this.consumeRecovery(tx, token, 'reset_password');
      if (record.user.email?.trim().toLowerCase() !== record.email) throw new BusinessException('Email changed. Request a new link.', 400, 'INVALID_RECOVERY_TOKEN');
      const current = await tx.authCredential.findUnique({ where: { userId: record.userId } });
      if (current && current.email !== record.email) throw new BusinessException('Email changed. Request a new link.', 400, 'INVALID_RECOVERY_TOKEN');
      await tx.authCredential.upsert({ where: { userId: record.userId },
        create: { userId: record.userId, email: record.email, passwordHash, emailVerifiedAt: new Date() },
        update: { passwordHash, emailVerifiedAt: new Date(), failedAttempts: 0, lockedUntil: null },
      });
      await tx.user.update({ where: { id: record.userId }, data: { sessionRevokedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.authRecoveryToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    return { message: 'Password updated. Sign in with your new password.' };
  }

  async verifyEmail(token: string) {
    await this.prisma.$transaction(async (tx) => {
      const record = await this.consumeRecovery(tx, token, 'verify_email');
      const updated = await tx.authCredential.updateMany({ where: { userId: record.userId, email: record.email }, data: { emailVerifiedAt: new Date() } });
      if (!updated.count) throw new BusinessException('Email changed. Request a new link.', 400, 'INVALID_RECOVERY_TOKEN');
    });
    return { message: 'Email verified.' };
  }

  private otpHash(id: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${id}:${code}`).digest('hex');
  }

  async requestOtp(dto: PhoneRequestDto) {
    const provider = this.config.get<string>('SMS_PROVIDER', 'console');
    if (this.config.get('NODE_ENV') === 'production' && provider === 'console') {
      throw new BusinessException('Phone sign-in is unavailable. Please use email or Google.', 503, 'SMS_UNAVAILABLE');
    }
    const challengeId = randomUUID();
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    // A DB advisory lock serializes sends per phone even across API instances.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.phone}))`;
      const recent = await tx.authOtpChallenge.count({ where: { phone: dto.phone, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
      const cooldown = await tx.authOtpChallenge.findFirst({ where: { phone: dto.phone, createdAt: { gt: new Date(Date.now() - 60_000) } } });
      if (cooldown || recent >= 5) throw new BusinessException('Wait before requesting another code.', 429, 'OTP_RATE_LIMIT');
      await tx.authOtpChallenge.updateMany({ where: { phone: dto.phone, usedAt: null }, data: { usedAt: new Date() } });
      await tx.authOtpChallenge.create({ data: { id: challengeId, phone: dto.phone, codeHash: this.otpHash(challengeId, code), intent: dto.intent ?? 'user', expiresAt: new Date(Date.now() + 5 * 60_000) } });
    });
    try {
      const body = `Your Lovenexa login code is ${code}. Valid for 5 minutes. Do not share it.`;
      if (provider === 'console') {
        const directory = join(process.cwd(), '.local', 'auth-sms');
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(join(directory, `${challengeId}.json`), JSON.stringify({ phone: dto.phone, body }), { mode: 0o600 });
      } else {
        const adapter = { twilio: this.twilio, msg91: this.msg91, textlocal: this.textlocal }[provider];
        if (!adapter) throw new Error('Unsupported SMS provider');
        const result = provider === 'msg91'
          ? await this.msg91.sendOtp(dto.phone, code)
          : await adapter.send({ to: dto.phone, body });
        if (!result.success) throw new Error('SMS delivery failed');
      }
    } catch {
      await this.prisma.authOtpChallenge.update({ where: { id: challengeId }, data: { usedAt: new Date() } });
      throw new BusinessException('Could not send the code. Please try again later.', 503, 'SMS_UNAVAILABLE');
    }
    return { challengeId, expiresIn: 300, resendAfter: 60 };
  }

  async verifyOtp(challengeId: string, code: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth_otp_challenges WHERE id = ${challengeId}::uuid FOR UPDATE`;
      if (!rows.length) return null;
      const challenge = await tx.authOtpChallenge.findUniqueOrThrow({ where: { id: challengeId } });
      if (challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return null;
      await tx.authOtpChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
      const valid = timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(this.otpHash(challengeId, code), 'hex'));
      if (!valid) return null; // Commit failed attempt; throwing inside would roll it back.
      await tx.authOtpChallenge.update({ where: { id: challengeId }, data: { usedAt: new Date() } });
      return challenge;
    });
    if (!outcome) throw new BusinessException('Invalid or expired code. Request a new one if needed.', 401, 'INVALID_OTP');
    const identity = await this.prisma.authPhoneIdentity.findUnique({ where: { phone: outcome.phone }, include: { user: true } });
    let user = identity?.user;
    let isNew = false;
    if (!user) {
      try {
        user = await this.createUser({ authIdentity: `phone_${randomUUID()}`, displayName: 'User', dateOfBirth: new Date('2000-01-01'), referralCode: generateReferralCode(), phone: outcome.phone, phoneIdentity: { create: { phone: outcome.phone } } });
        isNew = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        user = (await this.prisma.authPhoneIdentity.findUniqueOrThrow({ where: { phone: outcome.phone }, include: { user: true } })).user;
      }
    }
    if (isNew) await this.auth.grantSignupBonus(user.id);
    return this.auth.createUserSession(user, outcome.intent, isNew);
  }

  async googleLogin(subject: string, email: string, displayName: string, intent: string) {
    const identity = await this.prisma.authGoogleIdentity.findUnique({ where: { subject }, include: { user: true } });
    let user = identity?.user;
    if (!user) {
      const credential = await this.prisma.authCredential.findUnique({ where: { email }, include: { user: true } });
      if (credential && !credential.emailVerifiedAt) throw new BusinessException('Verify this account’s email or reset its password before using Google.', 409, 'EMAIL_VERIFICATION_REQUIRED');
      const matches = credential ? [credential.user] : await this.prisma.user.findMany({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, take: 2 });
      if (matches.length > 1) throw new BusinessException('Please contact support to link this Google account.', 409, 'AMBIGUOUS_ACCOUNT');
      user = matches[0];
      if (user) {
        this.active(user);
        await this.prisma.authGoogleIdentity.create({ data: { subject, userId: user.id } });
      } else {
        user = await this.createUser({ authIdentity: `google_${randomUUID()}`, email, displayName: displayName.slice(0, 50), dateOfBirth: new Date('2000-01-01'), referralCode: generateReferralCode(), googleIdentity: { create: { subject } } });
        await this.auth.grantSignupBonus(user.id);
      }
    }
    this.active(user);
    // Check admin access before issuing a handoff, without putting JWTs in URLs.
    if (intent === 'admin') {
      const roles = await this.prisma.userRole.findMany({ where: { userId: user.id, revokedAt: null } });
      if (!roles.some(({ role }) => ['admin', 'super_admin', 'moderator', 'grievance_officer', 'support'].includes(role))) throw new BusinessException('This account does not have admin access.', 403, 'ADMIN_ACCESS_REQUIRED');
    }
    const token = randomBytes(32).toString('hex');
    await this.prisma.authRecoveryToken.create({ data: { userId: user.id, email, purpose: 'google_login', intent, tokenHash: digest(token), expiresAt: new Date(Date.now() + 60_000) } });
    return token;
  }

  async exchangeGoogle(token: string) {
    const record = await this.prisma.$transaction((tx) => this.consumeRecovery(tx, token, 'google_login'));
    return this.auth.createUserSession(record.user, record.intent ?? 'user');
  }
}
