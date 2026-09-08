import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ReviewsService } from './reviews.service';

@Roles(Role.host)
@Controller('host')
export class HostReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('reviews')
  listReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getHostReviews(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('rating')
  getRating(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.getHostRating(user.id);
  }
}