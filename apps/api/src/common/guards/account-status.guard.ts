import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { BusinessException } from '../exceptions/business.exception';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AccountStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (!user) {
      return true;
    }

    if (user.status === UserStatus.banned) {
      throw new BusinessException('Account is permanently banned', 403, 'ACCOUNT_BANNED');
    }

    if (user.status === UserStatus.suspended) {
      throw new BusinessException(
        'Your account has been suspended. Please contact support.',
        403,
        'ACCOUNT_SUSPENDED',
      );
    }

    if (user.status === UserStatus.deleted) {
      throw new BusinessException('Account not found', 404, 'ACCOUNT_DELETED');
    }

    return true;
  }
}