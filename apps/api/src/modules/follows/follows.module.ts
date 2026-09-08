import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AdminFollowersController } from './admin-followers.controller';
import { FavoritesController } from './favorites.controller';
import { FollowsAdminService } from './follows-admin.service';
import { HostFollowController } from './host-follow.controller';
import { HostFollowersController } from './host-followers.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [UsersModule],
  controllers: [
    HostFollowController,
    FavoritesController,
    HostFollowersController,
    AdminFollowersController,
  ],
  providers: [FollowsService, FollowsAdminService],
  exports: [FollowsService, FollowsAdminService],
})
export class FollowsModule {}