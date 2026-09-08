import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminPromotionsQueryDto } from './dto/admin-promotions-query.dto';
import { BulkPromoActionDto } from './dto/bulk-promo-action.dto';
import { CreatePromoDto } from './dto/create-promo.dto';
import { PromotionsAdminService } from './promotions-admin.service';

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(private readonly admin: PromotionsAdminService) {}

  @Get()
  list(@Query() query: AdminPromotionsQueryDto) {
    return this.admin.list(query);
  }

  @Get('analytics')
  analytics() {
    return this.admin.getAnalytics();
  }

  @Get('export')
  async export(@Query() query: AdminPromotionsQueryDto, @Res() res: Response) {
    const { csv, count } = await this.admin.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="promotions-${count}.csv"`);
    res.send(csv);
  }

  @Post('bulk')
  bulk(@CurrentUser() admin: AuthenticatedUser, @Body() body: BulkPromoActionDto) {
    return this.admin.bulkAction(body.ids, body.action, admin.id);
  }

  @Post()
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreatePromoDto) {
    return this.admin.create(dto, admin.id);
  }

  @Post(':id/clone')
  clone(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.clone(id, admin.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePromoDto>,
  ) {
    return this.admin.update(id, dto, admin.id);
  }

  @Delete(':id')
  remove(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.remove(id, admin.id);
  }
}