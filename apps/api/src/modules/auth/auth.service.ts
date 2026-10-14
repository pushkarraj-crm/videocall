import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConsentDocumentType, Role, User, UserStatus, WalletTransactionType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { generateReferralCode } from '../../common/utils/referral-code.util';
import { PrismaService } from '../../database/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { coinsToUnits } from '../../common/constants/coins';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly referralsService: ReferralsService,
    private readonly config: ConfigService,
  ) {}

  async createUserSession(user: User, intent?: string, isNewUser = false) {
    if (user.deletedAt || user.status !== UserStatus.active) {
      throw new BusinessException('Account access denied', 403, 'ACCOUNT_BLOCKED');
    }
    const roles = await this.usersService.getUserRoles(user.id);
    if (intent === 'admin' && !roles.some((role) =>
      ['admin', 'super_admin', 'moderator', 'grievance_officer', 'support'].includes(role))) {
      throw new BusinessException('This account does not have admin access.', 403, 'ADMIN_ACCESS_REQUIRED');
    }
    const tokens = await this.issueTokenPair(user, roles);
    return { ...tokens, user: {
      id: user.id, displayName: user.displayName, status: user.status, roles,
      needsOnboarding: await this.userNeedsOnboarding(user.id),
    }, isNewUser };
  }
  async refreshSession(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new BusinessException('Session expired — please sign in again', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user || user.status === UserStatus.banned || user.status === UserStatus.suspended) {
      throw new BusinessException('Account access denied', 403, 'ACCOUNT_BLOCKED');
    }

    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BusinessException('Session expired — please sign in again', 401, 'INVALID_REFRESH_TOKEN');

    const roles = await this.usersService.getUserRoles(user.id);
    const tokens = await this.issueTokenPair(user, roles);
    const needsOnboarding = await this.userNeedsOnboarding(user.id);

    this.logger.log(
      `Session refresh userId=${user.id} roles=${roles.join(',')} needsOnboarding=${needsOnboarding}`,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        displayName: user.displayName,
        status: user.status,
        roles,
        needsOnboarding,
      },
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { loggedOut: true };
  }

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto, ip?: string, userAgent?: string) {
    if (!dto.acceptTerms || !dto.acceptPrivacy || !dto.acceptCommunityGuidelines || !dto.ageDeclaration) {
      throw new BusinessException('All consents are required', 400, 'CONSENT_REQUIRED');
    }

    const dob = new Date(dto.dateOfBirth);
    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18) {
      throw new BusinessException('You must be 18 or older', 403, 'UNDERAGE');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        dateOfBirth: dob,
        gender: dto.gender,
        primaryLanguage: dto.primaryLanguage ?? 'en',
        bio: dto.bio,
        deviceFingerprint: dto.deviceFingerprint,
      },
    });

    const consentTypes: ConsentDocumentType[] = [
      ConsentDocumentType.terms,
      ConsentDocumentType.privacy,
      ConsentDocumentType.community_guidelines,
      ConsentDocumentType.age_declaration,
    ];

    await this.prisma.userConsent.createMany({
      data: consentTypes.map((documentType) => ({
        userId,
        documentType,
        documentVersion: '1.0',
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      })),
    });

    if (dto.referralCode) {
      await this.referralsService.applyReferralCode(userId, dto.referralCode);
    }

    return { user, onboardingComplete: true };
  }

  async devLogin(dto: DevLoginDto) {
    if (this.config.get<string>('ENABLE_DEV_AUTH') !== 'true') {
      throw new BusinessException('Dev auth is disabled', 403, 'DEV_AUTH_DISABLED');
    }

    const role = dto.role ?? 'user';
    const roleDefaults: Record<
      'user' | 'host' | 'admin',
      { phone: string; displayName: string; seedCoins?: number }
    > = {
      user: { phone: '+919999990001', displayName: 'Dev User', seedCoins: 0 },
      host: { phone: '+919999990002', displayName: 'Dev Host' },
      admin: { phone: '+919999990003', displayName: 'Dev Admin' },
    };
    const defaults = roleDefaults[role];
    const phone = dto.phone ?? defaults.phone;
    const displayName = dto.displayName ?? defaults.displayName;
    const authIdentity = `dev_${phone.replace(/\D/g, '')}`;
    const completeOnboarding = dto.completeOnboarding ?? true;
    const seedCoins = dto.seedCoins ?? defaults.seedCoins;

    let user = await this.usersService.findByAuthIdentity(authIdentity);
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          authIdentity,
          phone,
          displayName,
          dateOfBirth: new Date('1995-06-15'),
          referralCode: generateReferralCode(),
        },
      });
      await this.usersService.assignRole(user.id, Role.user);
      await this.walletService.ensureWallet(user.id);
      await this.grantSignupBonus(user.id);
    }

    if (completeOnboarding) {
      await this.ensureOnboardingComplete(user.id, displayName);
      user = (await this.usersService.findById(user.id))!;
    }

    if (role === 'host') {
      await this.usersService.assignRole(user.id, Role.host);
      await this.prisma.hostProfile.upsert({
        where: { userId: user.id },
        update: { isAvailable: true },
        create: { userId: user.id, isAvailable: true, approvedAt: new Date() },
      });
    }

    if (role === 'admin') {
      await this.usersService.assignRole(user.id, Role.admin);
    }

    if (seedCoins && seedCoins > 0) {
      await this.walletService.creditWallet({
        userId: user.id,
        amountUnits: coinsToUnits(seedCoins),
        type: WalletTransactionType.admin_adjustment,
        referenceType: 'dev_login',
        referenceId: user.id,
        idempotencyKey: `dev:seed:${user.id}:${seedCoins}`,
        description: 'Dev login seed coins',
      });
    }

    const roles = await this.usersService.getUserRoles(user.id);
    const tokens = await this.issueTokenPair(user, roles);
    const needsOnboarding = await this.userNeedsOnboarding(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        displayName: user.displayName,
        status: user.status,
        roles,
        needsOnboarding,
      },
      isNewUser,
    };
  }

  private async issueTokenPair(user: User, roles: Role[]) {
    const payload: JwtPayload = {
      sub: user.id,
      authIdentity: user.authIdentity,
      roles: roles.map(String),
      sessionIssuedAt: Date.now(),
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshRaw = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(refreshRaw).digest('hex');
    const refreshDays = this.config.get<number>('JWT_REFRESH_EXPIRES_DAYS', 30);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken: refreshRaw,
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d'),
    };
  }

  async grantSignupBonus(userId: string) {
    const bonusCoins = this.config.get<number>('SIGNUP_BONUS_COINS', 100);
    if (bonusCoins <= 0) return;

    try {
      await this.walletService.creditWallet({
        userId,
        amountUnits: coinsToUnits(bonusCoins),
        type: WalletTransactionType.admin_adjustment,
        referenceType: 'signup_bonus',
        referenceId: userId,
        idempotencyKey: `signup:bonus:${userId}`,
        description: 'Welcome bonus',
      });
    } catch {
      /* idempotent — bonus already granted */
    }
  }

  private async userNeedsOnboarding(userId: string): Promise<boolean> {
    const consent = await this.prisma.userConsent.findFirst({
      where: { userId, documentType: ConsentDocumentType.terms },
    });
    return !consent;
  }

  private async ensureOnboardingComplete(userId: string, displayName: string) {
    const hasConsent = await this.prisma.userConsent.findFirst({
      where: { userId, documentType: ConsentDocumentType.terms },
    });

    if (hasConsent) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName,
        dateOfBirth: new Date('1995-06-15'),
        primaryLanguage: 'en',
      },
    });

    const consentTypes: ConsentDocumentType[] = [
      ConsentDocumentType.terms,
      ConsentDocumentType.privacy,
      ConsentDocumentType.community_guidelines,
      ConsentDocumentType.age_declaration,
    ];

    for (const documentType of consentTypes) {
      const existing = await this.prisma.userConsent.findFirst({
        where: { userId, documentType },
      });
      if (!existing) {
        await this.prisma.userConsent.create({
          data: { userId, documentType, documentVersion: '1.0' },
        });
      }
    }
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    const roles = await this.usersService.getUserRoles(userId);
    const wallet = await this.walletService.getWalletSummary(userId);
    const isHost = roles.includes(Role.host);

    let hostBio: string | null = null;
    let gallery: Array<{ id: string; url: string; filename: string; uploadedAt: string }> = [];

    if (isHost) {
      const host = await this.prisma.hostProfile.findUnique({
        where: { userId },
        select: { hostBio: true, virtualHostGallery: true },
      });
      hostBio = host?.hostBio ?? null;
      const raw = host?.virtualHostGallery;
      if (Array.isArray(raw)) {
        gallery = raw
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const rec = item as Record<string, unknown>;
            const url = typeof rec.url === 'string' ? rec.url : null;
            if (!url) return null;
            return {
              id: typeof rec.id === 'string' ? rec.id : url,
              url,
              filename: typeof rec.filename === 'string' ? rec.filename : url.split('/').pop() ?? url,
              uploadedAt:
                typeof rec.uploadedAt === 'string' ? rec.uploadedAt : new Date().toISOString(),
            };
          })
          .filter((g): g is { id: string; url: string; filename: string; uploadedAt: string } => !!g);
      }
    }

    return {
      id: user.id,
      authIdentity: user.authIdentity,
      phone: user.phone,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      primaryLanguage: user.primaryLanguage,
      referralCode: user.referralCode,
      status: user.status,
      freeCallsUsed: user.freeCallsUsed,
      lastLoginAt: user.lastLoginAt,
      walletCoins: wallet.balanceCoins,
      roles,
      wallet,
      /** Profile-edit fields (User + Host) — same identity as session */
      isHost,
      hostBio,
      gallery,
    };
  }
}
