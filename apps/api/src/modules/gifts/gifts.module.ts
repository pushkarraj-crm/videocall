import { Module } from '@nestjs/common';
import { AdminGiftsController } from './admin-gifts.controller';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  controllers: [GiftsController, AdminGiftsController],
  providers: [GiftsService],
  exports: [GiftsService],
})
export class GiftsModule {}