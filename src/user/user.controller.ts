import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  PipeTransform,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuardService } from 'src/auth-guard/auth-guard.service';
import {
  UpdateUsernameDto,
  UpdatePasswordDto,
  VerifyPasswordDto,
} from './dto/user.dto';

@Controller('/api/v1/user')
@UseGuards(AuthGuardService)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('all')
  @HttpCode(HttpStatus.OK)
  getAllUsers() {
    return this.userService.getUsers();
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  searchUsersByLocation(@Query() searchParams: SearchUsersParams) {
    if (!searchParams.location) {
      throw new BadRequestException('Location parameter is required');
    }
    return this.userService.searchUsersByLocation(searchParams);
  }

  @Get('/:userId')
  @HttpCode(HttpStatus.OK)
  getUserById(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getUser(userId);
  }

  @Put('/:userId/username')
  @HttpCode(HttpStatus.OK)
  updateUsername(
    @Param('userId') userId: string,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!updateUsernameDto.username) {
      throw new BadRequestException('Username is required');
    }
    return this.userService.editUsername(userId, updateUsernameDto.username);
  }

  @Put('/:userId/password')
  @HttpCode(HttpStatus.OK)
  updatePassword(
    @Param('userId') userId: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!updatePasswordDto.password) {
      throw new BadRequestException('Password is required');
    }
    return this.userService.updateUserPassword(
      userId,
      updatePasswordDto.password,
    );
  }

  @Post('/:userId/verifyPassword')
  @HttpCode(HttpStatus.OK)
  verifyPassword(
    @Param('userId') userId: string,
    @Body() verifyPasswordDto: VerifyPasswordDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!verifyPasswordDto.password) {
      throw new BadRequestException('Password is required');
    }
    return this.userService.verifyPassword(userId, verifyPasswordDto.password);
  }

  @Put('/:userId/metadata')
  @HttpCode(HttpStatus.OK)
  updateUserMetadata(
    @Param('userId') userId: string,
    @Body() updateMetadataDto: UpdateUserMetadataParams,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (
      !updateMetadataDto.location &&
      !updateMetadataDto.dateOfBirth &&
      !updateMetadataDto.gender
    ) {
      throw new BadRequestException('At least one metadata field is required');
    }
    return this.userService.updateUserMetadata(userId, updateMetadataDto);
  }
}
