import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AiVideoAvatarService } from './ai-video-avatar.service';

@Controller('virtual-hosts/video-avatar')
@UseGuards(JwtAuthGuard)
export class AiVideoAvatarController {
  constructor(private readonly videoAvatar: AiVideoAvatarService) {}

  @Get('catalog')
  catalog() {
    return this.videoAvatar.getCatalog();
  }
}