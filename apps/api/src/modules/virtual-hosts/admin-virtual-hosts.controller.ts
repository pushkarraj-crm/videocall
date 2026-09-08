import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
type UploadedMediaFile = { buffer: Buffer; originalname: string; mimetype?: string };

const uploadOpts = {
  limits: { fileSize: 200 * 1024 * 1024 },
};
import { Role, VirtualHostStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiConversationService } from './conversation/ai-conversation.service';
import { ConversationConfigDto } from './conversation/dto/conversation-config.dto';
import { UpdateAIHostMemoryDto } from './conversation/dto/update-memory.dto';
import { CreateVirtualHostDto } from './dto/create-virtual-host.dto';
import { UpdateVirtualHostDto } from './dto/update-virtual-host.dto';
import { AiAvatarService } from './avatar/ai-avatar.service';
import { AiVideoAvatarService } from './video-avatar/ai-video-avatar.service';
import { VideoConfigDto } from './video-avatar/dto/video-config.dto';
import { WardrobeConfigDto } from './video-avatar/dto/wardrobe.dto';
import { AvatarConfigDto } from './avatar/dto/avatar-config.dto';
import { AiVoiceService } from './voice/ai-voice.service';
import { VoiceConfigDto } from './voice/dto/voice-config.dto';
import { VoiceTestDto } from './voice/dto/voice-test.dto';
import { VirtualHostsService } from './virtual-hosts.service';

@Controller('admin/virtual-hosts')
@UseGuards(RolesGuard)
@Roles(Role.admin, Role.super_admin)
export class AdminVirtualHostsController {
  constructor(
    private readonly virtualHosts: VirtualHostsService,
    private readonly conversation: AiConversationService,
    private readonly voice: AiVoiceService,
    private readonly avatar: AiAvatarService,
    private readonly videoAvatar: AiVideoAvatarService,
  ) {}

  @Get()
  list() {
    return this.virtualHosts.adminList();
  }

  @Get('analytics')
  analytics() {
    return this.virtualHosts.getAdminAnalytics();
  }

  @Get('conversation/analytics')
  conversationAnalytics(@Query('hostId') hostId?: string) {
    return this.conversation.getConversationAnalytics(hostId);
  }

  @Get('voice/analytics')
  voiceAnalytics(@Query('hostId') hostId?: string) {
    return this.voice.getVoiceAnalytics(hostId);
  }

  @Post('voice/test')
  testVoice(@Body() dto: VoiceTestDto) {
    return this.voice.testVoice(dto);
  }

  @Get('avatar/catalog')
  avatarCatalog() {
    return this.avatar.getCatalog();
  }

  @Post('avatar/preview')
  avatarPreview(@Body() body: { hostId?: string } & AvatarConfigDto) {
    const { hostId, ...overrides } = body;
    return this.avatar.previewConfig(hostId, overrides);
  }

  @Get('memory')
  listMemories(@Query('hostId') hostId?: string, @Query('userId') userId?: string) {
    return this.conversation.adminListMemories(hostId, userId);
  }

  @Get('memory/:hostId/:userId')
  getMemory(@Param('hostId') hostId: string, @Param('userId') userId: string) {
    return this.conversation.adminGetMemory(hostId, userId);
  }

  @Patch('memory/:hostId/:userId')
  updateMemory(
    @Param('hostId') hostId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateAIHostMemoryDto,
  ) {
    return this.conversation.adminUpdateMemory(hostId, userId, dto);
  }

  @Delete('memory/:hostId/:userId')
  deleteMemory(@Param('hostId') hostId: string, @Param('userId') userId: string) {
    return this.conversation.adminDeleteMemory(hostId, userId);
  }

  @Get('video-avatar/catalog')
  videoAvatarCatalog() {
    return this.videoAvatar.getCatalog();
  }

  @Post('video-avatar/preview')
  videoAvatarPreview(@Body() body: { hostId?: string } & VideoConfigDto) {
    const { hostId, ...overrides } = body;
    return this.videoAvatar.preview(hostId, overrides);
  }

  @Get(':hostId/assets')
  getAssets(@Param('hostId') hostId: string) {
    return this.virtualHosts.adminGetAssets(hostId);
  }

  @Post(':hostId/assets/refresh')
  refreshAssets(@Param('hostId') hostId: string) {
    return this.virtualHosts.adminRefreshAssets(hostId);
  }

  @Post(':hostId/videos')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadVideo(
    @Param('hostId') hostId: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    if (!file?.buffer?.length) {
      return { error: 'No file uploaded' };
    }
    return this.virtualHosts.adminUploadVideo(hostId, file.buffer, file.originalname);
  }

  @Post(':hostId/profile-image')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadProfileImage(
    @Param('hostId') hostId: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    if (!file?.buffer?.length) {
      return { error: 'No file uploaded' };
    }
    return this.virtualHosts.adminUploadProfileImage(hostId, file.buffer, file.originalname);
  }

  @Post(':hostId/gallery')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadGallery(
    @Param('hostId') hostId: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    if (!file?.buffer?.length) {
      return { error: 'No file uploaded' };
    }
    return this.virtualHosts.adminUploadGalleryImage(hostId, file.buffer, file.originalname);
  }

  @Delete(':hostId/gallery/:imageId')
  removeGallery(@Param('hostId') hostId: string, @Param('imageId') imageId: string) {
    return this.virtualHosts.adminRemoveGalleryImage(hostId, imageId);
  }

  @Delete(':hostId/videos/:filename')
  removeVideo(@Param('hostId') hostId: string, @Param('filename') filename: string) {
    return this.virtualHosts.adminRemoveVideo(hostId, decodeURIComponent(filename));
  }

  @Get(':hostId')
  get(@Param('hostId') hostId: string) {
    return this.virtualHosts.adminGet(hostId);
  }

  @Patch(':hostId/conversation')
  updateConversation(@Param('hostId') hostId: string, @Body() dto: ConversationConfigDto) {
    return this.conversation.adminUpdateConversationConfig(hostId, dto);
  }

  @Patch(':hostId/voice')
  updateVoice(@Param('hostId') hostId: string, @Body() dto: VoiceConfigDto) {
    return this.voice.adminUpdateVoiceConfig(hostId, dto);
  }

  @Patch(':hostId/avatar')
  updateAvatar(@Param('hostId') hostId: string, @Body() dto: AvatarConfigDto) {
    return this.avatar.adminUpdateAvatarConfig(hostId, dto);
  }

  @Patch(':hostId/video')
  updateVideo(@Param('hostId') hostId: string, @Body() dto: VideoConfigDto) {
    return this.videoAvatar.adminUpdateVideoConfig(hostId, dto);
  }

  @Patch(':hostId/wardrobe')
  updateWardrobe(@Param('hostId') hostId: string, @Body() dto: WardrobeConfigDto) {
    return this.videoAvatar.adminUpdateWardrobe(hostId, dto);
  }

  @Post(':hostId/wardrobe/:outfitId/activate')
  activateOutfit(@Param('hostId') hostId: string, @Param('outfitId') outfitId: string) {
    return this.videoAvatar.adminSetActiveOutfit(hostId, outfitId);
  }

  @Post(':hostId/memory/reset')
  resetMemory(@Param('hostId') hostId: string, @Body() body: { userId: string }) {
    return this.conversation.adminResetMemory(hostId, body.userId);
  }

  @Post()
  create(@Body() dto: CreateVirtualHostDto) {
    return this.virtualHosts.adminCreate(dto);
  }

  @Patch(':hostId')
  update(@Param('hostId') hostId: string, @Body() dto: UpdateVirtualHostDto) {
    return this.virtualHosts.adminUpdate(hostId, dto);
  }

  @Patch(':hostId/status')
  setStatus(@Param('hostId') hostId: string, @Body() body: { status: VirtualHostStatus }) {
    return this.virtualHosts.adminSetStatus(hostId, body.status);
  }

  @Delete(':hostId')
  remove(@Param('hostId') hostId: string) {
    return this.virtualHosts.adminDelete(hostId);
  }
}