import { Global, Module } from '@nestjs/common';
import { AiHostAssetsService } from './ai-host-assets.service';
import { AiVideoCatalogService } from './ai-video-catalog.service';

@Global()
@Module({
  providers: [AiHostAssetsService, AiVideoCatalogService],
  exports: [AiHostAssetsService, AiVideoCatalogService],
})
export class AiHostAssetsModule {}