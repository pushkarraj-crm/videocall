import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from './users.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
  ) {}

  /**
   * MUST be declared before @Get(':id') so "me" is not treated as a user UUID.
   * Returns the authenticated user's editable profile (name, bio, gallery, …).
   */
  @Get('me')
  getEditableProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getEditableProfile(user.id);
  }

  @Get(':id')
  getPublicProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    if (!UUID_RE.test(id)) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }
    return this.usersService.getPublicProfile(user.id, id);
  }
}
