import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConsentDocumentType, Role, WalletTransactionType } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { generateReferralCode } from '../../common/utils/referral-code.util';
import { PrismaService } from '../../database/prisma.service';
import { FirebaseService } from '../../integrations/firebase/firebase.service';
import { ReferralsService } from '../referrals/referrals.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { coinsToUnits } from '../../common/constants/coins';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly referralsService: ReferralsService,
    private readonly config: ConfigService,
  ) {}

  async verifyFirebaseToken(idToken: string) {
    const decoded = await this.firebase.verifyIdToken(idToken);

    let user = await this.usersService.findByFirebaseUid(decoded.uid);

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          phone: decoded.phone_number ?? null,
          email: decoded.email ?? null,
          displayName: decoded.name ?? decoded.email?.split('@')[0] ?? 'User',
          dateOfBirth: new Date('2000-01-01'),
          referralCode: generateReferralCode(),
        },
      });

      await this.usersService.assignRole(user.id, Role.user);
      await this.walletService.ensureWallet(user.id);
    }

    const roles = await this.usersService.getUserRoles(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      firebaseUid: user.firebaseUid,
      roles: roles.map(String),
    };

    const accessToken = await this.jwt.signAsync(payload);
    const needsOnboarding = await this.userNeedsOnboarding(user.id);

    return {
      accessToken,
      user: {
        id: user.id,
        displayName: user.displayName,
        status: user.status,
        roles,
        needsOnboarding,
      },
    };
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
      user: { phone: '+919999990001', displayName: 'Dev User', seedCoins: 500 },
      host: { phone: '+919999990002', displayName: 'Dev Host' },
      admin: { phone: '+919999990003', displayName: 'Dev Admin' },
    };
    const defaults = roleDefaults[role];
    const phone = dto.phone ?? defaults.phone;
    const displayName = dto.displayName ?? defaults.displayName;
    const firebaseUid = `dev_${phone.replace(/\D/g, '')}`;
    const completeOnboarding = dto.completeOnboarding ?? true;
    const seedCoins = dto.seedCoins ?? defaults.seedCoins;

    let user = await this.usersService.findByFirebaseUid(firebaseUid);
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          firebaseUid,
          phone,
          displayName,
          dateOfBirth: new Date('1995-06-15'),
          referralCode: generateReferralCode(),
        },
      });
      await this.usersService.assignRole(user.id, Role.user);
      await this.walletService.ensureWallet(user.id);
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
    const payload: JwtPayload = {
      sub: user.id,
      firebaseUid: user.firebaseUid,
      roles: roles.map(String),
    };

    const accessToken = await this.jwt.signAsync(payload);
    const needsOnboarding = await this.userNeedsOnboarding(user.id);

    return {
      accessToken,
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

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
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
      roles,
      wallet,
    };
  }
}