import { ChatlistService } from './chatlist.service';
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { User } from '@clerk/backend';
import { AuthGuardService } from 'src/auth-guard/auth-guard.service';
import { GetUser } from 'auth/get-user.decorator';

@Controller('chatlist')
@UseGuards(AuthGuardService)
export class ChatlistController {
  constructor(private readonly chatlistService: ChatlistService) {}

  @Get(':roomId/history')
  async getChatHistory(
    @Param('roomId') roomId: string,
    @GetUser() user: User,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const userId = user.id;

    const canAccess = await this.chatlistService.isUserInRoom(userId, roomId);
    if (!canAccess) {
      throw new ForbiddenException(
        'You do not have permission to access this chat room.',
      );
    }

    const historyData = await this.chatlistService.getChatHistory(
      roomId,
      limit,
      offset,
    );

    return historyData;
  }
}
