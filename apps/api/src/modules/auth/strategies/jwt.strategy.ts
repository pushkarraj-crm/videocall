import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  firebaseUid: string;
  roles: string[];
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

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.deletedAt) {
      throw new BusinessException('User not found', 401, 'USER_NOT_FOUND');
    }

    const roles = await this.usersService.getUserRoles(user.id);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      displayName: user.displayName,
      status: user.status,
      roles,
    };
  }
}