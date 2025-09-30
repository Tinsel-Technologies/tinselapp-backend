import { Module } from '@nestjs/common';
import { UploadthingService } from './uploadthing.service';
import { UploadthingController } from './uploadthing.controller';

@Module({
  controllers: [UploadthingController],
  providers: [UploadthingService],
})
export class UploadthingModule {}
