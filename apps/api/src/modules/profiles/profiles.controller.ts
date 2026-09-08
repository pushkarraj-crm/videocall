import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

/** Memory upload — same approach as admin virtual-host media. */
const uploadOpts = {
  limits: { fileSize: 5 * 1024 * 1024 },
};

type UploadedMediaFile = {
  buffer?: Buffer;
  originalname?: string;
  mimetype?: string;
};

@Controller('users/me')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // GET /users/me is handled by UsersController.getEditableProfile (must win over :id).
  // This controller keeps PATCH/media under the users/me prefix.

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateProfile(user.id, dto);
  }

  @Get('consents')
  getConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getConsents(user.id);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    return this.profilesService.uploadAvatar(
      user.id,
      file?.buffer ?? Buffer.alloc(0),
      file?.originalname ?? 'avatar.jpg',
    );
  }

  @Delete('avatar')
  clearAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.clearAvatar(user.id);
  }

  @Post('gallery')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadGallery(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    return this.profilesService.uploadGalleryImage(
      user.id,
      file?.buffer ?? Buffer.alloc(0),
      file?.originalname ?? 'gallery.jpg',
    );
  }

  @Delete('gallery/:imageId')
  removeGallery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId') imageId: string,
  ) {
    return this.profilesService.removeGalleryImage(user.id, imageId);
  }
}
