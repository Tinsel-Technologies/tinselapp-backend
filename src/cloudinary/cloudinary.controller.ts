import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Delete,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';

@Controller('api/v1/upload')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.cloudinaryService.uploadFile(file);
    return {
      message: 'File uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      },
    };
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const results = await this.cloudinaryService.uploadMultipleFiles(files);
    return {
      message: 'Files uploaded successfully',
      data: results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      })),
    };
  }

  @Delete('single')
  async deleteFile(@Body('publicId') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('publicId is required');
    }

    await this.cloudinaryService.deleteFile(publicId);
    return {
      message: 'File deleted successfully',
    };
  }

  @Delete('multiple')
  async deleteMultipleFiles(@Body('publicIds') publicIds: string[]) {
    if (!publicIds || publicIds.length === 0) {
      throw new BadRequestException('publicIds array is required');
    }

    await this.cloudinaryService.deleteMultipleFiles(publicIds);
    return {
      message: 'Files deleted successfully',
    };
  }
}