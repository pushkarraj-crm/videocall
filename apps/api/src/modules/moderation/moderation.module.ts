import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ModerationService } from './moderation.service';

@Module({
  imports: [UsersModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}