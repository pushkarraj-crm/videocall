import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { VirtualHostsService } from './virtual-hosts.service';

@Controller('virtual-hosts')
@UseGuards(JwtAuthGuard)
export class VirtualHostsController {
  constructor(private readonly virtualHosts: VirtualHostsService) {}

  @Get('session/:callId')
  getSession(@Param('callId') callId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.virtualHosts.getSessionForCall(callId, user.id);
  }

  @Get('memory/:hostId')
  getMemory(@Param('hostId') hostId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.virtualHosts.getMemory(user.id, hostId);
  }
}