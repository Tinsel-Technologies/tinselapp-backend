import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  CheckUsernameDto,
  UserParamsDto,
  RemoveFromChatListDto,
  CheckChatListDto,
  AddToChatListDto,
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
  async updateUsername(
    @Param('userId') userId: string,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!updateUsernameDto.username) {
      throw new BadRequestException('Username is required');
    }

    const availabilityCheck = await this.userService.checkUsernameAvailability(
      updateUsernameDto.username,
    );

    if (!availabilityCheck.available) {
      throw new BadRequestException({
        message: 'Username is already taken',
        suggestions: availabilityCheck.suggestions,
      });
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

  @Post('checkUsername')
  @HttpCode(HttpStatus.OK)
  checkUsernameAvailability(@Body() checkUsernameDto: CheckUsernameDto) {
    return this.userService.checkUsernameAvailability(
      checkUsernameDto.username,
    );
  }

  @Get('/:userId/suggestUsername')
  @HttpCode(HttpStatus.OK)
  suggestUsername(@Param() params: UserParamsDto) {
    return this.userService.suggestUsername(params.userId);
  }

  @Post(':userId/chat-list/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async addToChatList(
    @Param('userId') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.userService.addToChatList(userId, targetUserId);
  }

  @Delete(':userId/chat-list/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async removeFromChatList(
    @Param('userId') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.userService.removeFromChatList(userId, targetUserId);
  }

  @Get(':userId/chat-list')
  async getChatList(@Param('userId') userId: string) {
    return this.userService.getChatList(userId);
  }

  @Get(':userId/chat-list/:targetUserId/status')
  async isInChatList(
    @Param('userId') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    const isInChatList = await this.userService.isInChatList(
      userId,
      targetUserId,
    );
    return { isInChatList };
  }

  @Get(':userId/chat-list-count')
  async getChatListCount(@Param('userId') userId: string) {
    const count = await this.userService.getChatListCount(userId);
    return { count };
  }

  @Delete(':userId/chat-list')
  @HttpCode(HttpStatus.OK)
  async clearChatList(@Param('userId') userId: string) {
    return this.userService.clearChatList(userId);
  }
}
