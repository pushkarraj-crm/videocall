import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AdminReviewsController } from './admin-reviews.controller';
import { HostReviewsController } from './host-reviews.controller';
import { ReviewsAdminService } from './reviews-admin.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [UsersModule],
  controllers: [ReviewsController, HostReviewsController, AdminReviewsController],
  providers: [ReviewsService, ReviewsAdminService],
  exports: [ReviewsService, ReviewsAdminService],
})
export class ReviewsModule {}