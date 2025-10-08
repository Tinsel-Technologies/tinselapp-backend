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
  SuggestUsersDto,
  GetChatListDto,
  BulkAddToChatListDto,
  BulkRemoveFromChatListDto,
  UpdateOnlineStatusDto,
  BulkOnlineStatusDto,
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
  @Put('/:userId/about')
  @HttpCode(HttpStatus.OK)
  updateUserAboutMetadata(
    @Param('userId') userId: string,
    @Body() body: AboutMetadata,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!body.about) {
      throw new BadRequestException('At least one metadata field is required');
    }
    return this.userService.updateUserAboutMetadata(userId, body);
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

  @Post('/:userId/chatlist/add')
  @HttpCode(HttpStatus.OK)
  addToChatList(
    @Param('userId') userId: string,
    @Body() addToChatListDto: AddToChatListDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!addToChatListDto.targetUserId) {
      throw new BadRequestException('Target User ID is required');
    }
    return this.userService.addToChatList(
      userId,
      addToChatListDto.targetUserId,
    );
  }

  @Delete('/:userId/chatlist/remove')
  @HttpCode(HttpStatus.OK)
  removeFromChatList(
    @Param('userId') userId: string,
    @Body() removeFromChatListDto: RemoveFromChatListDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!removeFromChatListDto.targetUserId) {
      throw new BadRequestException('Target User ID is required');
    }
    return this.userService.removeFromChatList(
      userId,
      removeFromChatListDto.targetUserId,
    );
  }

  @Get('/:userId/chatlist')
  @HttpCode(HttpStatus.OK)
  getChatList(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getChatList(userId);
  }

  @Post('/:userId/chatlist/check')
  @HttpCode(HttpStatus.OK)
  checkIfInChatList(
    @Param('userId') userId: string,
    @Body() checkChatListDto: CheckChatListDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!checkChatListDto.targetUserId) {
      throw new BadRequestException('Target User ID is required');
    }
    return this.userService.isInChatList(userId, checkChatListDto.targetUserId);
  }

  @Get('/:userId/chatlist/count')
  @HttpCode(HttpStatus.OK)
  getChatListCount(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getChatListCount(userId);
  }

  @Delete('/:userId/chatlist/clear')
  @HttpCode(HttpStatus.OK)
  clearChatList(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.clearChatList(userId);
  }

  @Get('/:userId/suggestions')
  @HttpCode(HttpStatus.OK)
  suggestUsers(
    @Param('userId') userId: string,
    @Query() suggestUsersDto: SuggestUsersDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.suggestUsers(userId, suggestUsersDto.limit);
  }

  @Get('/:userId/chatlist/all')
  @HttpCode(HttpStatus.OK)
  getAllChatListUsers(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getAllChatListUsers(userId);
  }

  @Get('/:userId/chatlist/paginated')
  @HttpCode(HttpStatus.OK)
  getChatListUsersPaginated(
    @Param('userId') userId: string,
    @Query() getChatListDto: GetChatListDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getChatListUsersPaginated(
      userId,
      getChatListDto.page,
      getChatListDto.limit,
    );
  }

  @Post('/:userId/chatlist/bulk-add')
  @HttpCode(HttpStatus.OK)
  addMultipleUsersToChatList(
    @Param('userId') userId: string,
    @Body() bulkAddDto: BulkAddToChatListDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!bulkAddDto.targetUserIds || bulkAddDto.targetUserIds.length === 0) {
      throw new BadRequestException('Target user IDs array is required');
    }
    return this.userService.addMultipleUsersToChatList(
      userId,
      bulkAddDto.targetUserIds,
    );
  }

  @Delete('/:userId/chatlist/bulk-remove')
  @HttpCode(HttpStatus.OK)
  removeMultipleUsersFromChatList(
    @Param('userId') userId: string,
    @Body() bulkRemoveDto: BulkRemoveFromChatListDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (
      !bulkRemoveDto.targetUserIds ||
      bulkRemoveDto.targetUserIds.length === 0
    ) {
      throw new BadRequestException('Target user IDs array is required');
    }
    return this.userService.removeMultipleUsersFromChatList(
      userId,
      bulkRemoveDto.targetUserIds,
    );
  }

  @Put('/:userId/status/online')
  @HttpCode(HttpStatus.OK)
  setOnlineStatus(
    @Param('userId') userId: string,
    @Body() updateStatusDto: UpdateOnlineStatusDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.setOnlineStatus(userId, updateStatusDto.isOnline);
  }

  @Get('/:userId/status/online')
  @HttpCode(HttpStatus.OK)
  getOnlineStatus(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getOnlineStatus(userId);
  }

  @Post('/status/bulk')
  @HttpCode(HttpStatus.OK)
  getBulkOnlineStatus(@Body() bulkStatusDto: BulkOnlineStatusDto) {
    if (!bulkStatusDto.userIds || bulkStatusDto.userIds.length === 0) {
      throw new BadRequestException('User IDs array is required');
    }
    return this.userService.getBulkOnlineStatus(bulkStatusDto.userIds);
  }

  @Get('/status/online-users')
  @HttpCode(HttpStatus.OK)
  getOnlineUsers() {
    return this.userService.getOnlineUsers();
  }

  @Get('/:userId/chatlist/online-status')
  @HttpCode(HttpStatus.OK)
  getChatListOnlineStatus(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.userService.getChatListOnlineStatus(userId);
  }
}
