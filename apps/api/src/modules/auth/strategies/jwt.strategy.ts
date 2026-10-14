import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  authIdentity: string;
  roles: string[];
  sessionIssuedAt?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload & { iat?: number }): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.sub) || 'purpose' in payload) {
      throw new BusinessException('Invalid access token', 401, 'INVALID_ACCESS_TOKEN');
    }
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.deletedAt) {
      throw new BusinessException('User not found', 401, 'USER_NOT_FOUND');
    }

    if (user.sessionRevokedAt && payload.iat) {
      const issuedAtMs = payload.sessionIssuedAt ?? payload.iat * 1000;
      if (issuedAtMs < user.sessionRevokedAt.getTime()) {
        throw new BusinessException('Session expired. Please sign in again.', 401, 'SESSION_REVOKED');
      }
    }

    const roles = await this.usersService.getUserRoles(user.id);

    return {
      id: user.id,
      authIdentity: user.authIdentity,
      displayName: user.displayName,
      status: user.status,
      roles,
    };
  }
}
