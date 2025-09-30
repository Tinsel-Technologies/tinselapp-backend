import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryProvider } from './cloudinary.provider';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports:[ConfigModule],
  controllers: [CloudinaryController],
  providers: [CloudinaryService, CloudinaryProvider],
  exports:[CloudinaryProvider]
})
export class CloudinaryModule {}
