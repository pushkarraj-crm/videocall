import { Module } from '@nestjs/common';
import { ZegoService } from './zego.service';

@Module({
  providers: [ZegoService],
  exports: [ZegoService],
})
export class ZegoModule {}