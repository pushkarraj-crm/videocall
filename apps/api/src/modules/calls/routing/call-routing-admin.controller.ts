import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CallRoutingService } from './call-routing.service';
import { UpdateCallRoutingSettingsDto } from './dto/call-routing-settings.dto';

@Controller('admin/settings/call-routing')
@UseGuards(RolesGuard)
@Roles(Role.admin, Role.super_admin)
export class CallRoutingAdminController {
  constructor(private readonly routing: CallRoutingService) {}

  @Get()
  getSettings() {
    return this.routing.getSettings();
  }

  @Patch()
  updateSettings(@Body() dto: UpdateCallRoutingSettingsDto) {
    return this.routing.updateSettings(dto);
  }
}