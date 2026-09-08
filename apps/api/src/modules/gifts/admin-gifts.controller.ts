import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateGiftCatalogDto, UpdateGiftCatalogDto } from './dto/admin-gift.dto';
import { GiftsService } from './gifts.service';

@Controller('admin/gifts')
@UseGuards(RolesGuard)
@Roles(Role.admin, Role.super_admin)
export class AdminGiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Get()
  list() {
    return this.giftsService.adminList();
  }

  @Get('analytics')
  analytics() {
    return this.giftsService.getAdminAnalytics();
  }

  @Post()
  create(@Body() dto: CreateGiftCatalogDto) {
    return this.giftsService.adminCreate(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGiftCatalogDto) {
    return this.giftsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.giftsService.adminDelete(id);
  }
}