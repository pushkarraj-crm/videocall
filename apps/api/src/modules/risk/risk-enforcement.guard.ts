import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RiskActionsService } from './risk-actions.service';

const FREEZE_ROUTES: Array<{
  method: string;
  path: RegExp;
  check: keyof Awaited<ReturnType<RiskActionsService['getRestrictions']>>;
  message: string;
}> = [
  {
    method: 'POST',
    path: /\/hosts\/withdrawals\/?$/,
    check: 'freezeWithdrawals',
    message: 'Withdrawals temporarily frozen pending risk review',
  },
  {
    method: 'POST',
    path: /\/referral\/apply\/?$/,
    check: 'freezeReferralRewards',
    message: 'Referral rewards temporarily frozen pending risk review',
  },
  {
    method: 'POST',
    path: /\/referrals\/apply\/?$/,
    check: 'freezeReferralRewards',
    message: 'Referral rewards temporarily frozen pending risk review',
  },
  {
    method: 'POST',
    path: /\/promotions\/apply\/?$/,
    check: 'freezeCouponRedemption',
    message: 'Coupon redemption temporarily frozen pending risk review',
  },
  {
    method: 'POST',
    path: /\/promotions\/checkout\/?$/,
    check: 'freezeCouponRedemption',
    message: 'Coupon redemption temporarily frozen pending risk review',
  },
];

@Injectable()
export class RiskEnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly actions: RiskActionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      url: string;
      user?: AuthenticatedUser;
    }>();

    const user = req.user;
    if (!user?.id) return true;

    const path = req.path ?? req.url.split('?')[0];
    const match = FREEZE_ROUTES.find((r) => r.method === req.method && r.path.test(path));
    if (!match) return true;

    const restrictions = await this.actions.getRestrictions(user.id);
    if (restrictions[match.check]) {
      throw new BusinessException(match.message, 403, 'RISK_FROZEN');
    }

    return true;
  }
}