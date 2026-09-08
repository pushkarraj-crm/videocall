import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AiAvatarService } from './ai-avatar.service';

@Controller('virtual-hosts/avatar')
@UseGuards(JwtAuthGuard)
export class AiAvatarController {
  constructor(private readonly avatar: AiAvatarService) {}

  @Get('catalog')
  catalog() {
    return this.avatar.getCatalog();
  }
}