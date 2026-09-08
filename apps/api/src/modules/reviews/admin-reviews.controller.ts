import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminReviewActionDto } from './dto/admin-review-action.dto';
import { AdminReviewsQueryDto } from './dto/admin-reviews-query.dto';
import { ReviewsAdminService } from './reviews-admin.service';

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsAdmin: ReviewsAdminService) {}

  @Get()
  list(@Query() query: AdminReviewsQueryDto) {
    return this.reviewsAdmin.listReviews(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.reviewsAdmin.getReviewById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AdminReviewActionDto) {
    return this.reviewsAdmin.updateReview(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.reviewsAdmin.deleteReview(id);
  }
}