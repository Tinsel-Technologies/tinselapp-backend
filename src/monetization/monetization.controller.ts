import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MonetizationService } from './monetization.service';
import { AuthGuardService } from '../auth-guard/auth-guard.service';
import {
  SetMonetizationSettingsDto,
  UpdateMonetizationSettingsDto,
  PurchaseChatTimeDto,
  CalculateContentCostDto,
} from './dto/monetization.dto';

@Controller('/api/v1/monetization')
@UseGuards(AuthGuardService)
export class MonetizationController {
  constructor(private readonly monetizationService: MonetizationService) {}

  @Post('/:userId/settings')
  @HttpCode(HttpStatus.OK)
  setMonetizationSettings(
    @Param('userId') userId: string,
    @Body() dto: SetMonetizationSettingsDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.setMonetizationSettings(userId, dto);
  }

  @Get('/:userId/settings')
  @HttpCode(HttpStatus.OK)
  getMonetizationSettings(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.getMonetizationSettings(userId);
  }

  @Get('/:userId/info')
  @HttpCode(HttpStatus.OK)
  getMonetizationInfo(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.getMonetizationInfo(userId);
  }

  // Purchase chat time
  @Post('/chat-time/purchase')
  @HttpCode(HttpStatus.CREATED)
  purchaseChatTime(@Body() dto: PurchaseChatTimeDto & { buyerId: string }) {
    if (!dto.buyerId) {
      throw new BadRequestException('Buyer ID is required');
    }
    return this.monetizationService.purchaseChatTime(dto.buyerId, dto);
  }

  @Get('/sessions/active')
  @HttpCode(HttpStatus.OK)
  getActiveSession(
    @Query('userId1') userId1: string,
    @Query('userId2') userId2: string,
  ) {
    if (!userId1 || !userId2) {
      throw new BadRequestException('Both user IDs are required');
    }
    return this.monetizationService.getActiveSession(userId1, userId2);
  }

  @Get('/:userId/sessions')
  @HttpCode(HttpStatus.OK)
  getUserSessions(
    @Param('userId') userId: string,
    @Query('active') active?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    const isActive = active !== undefined ? active === 'true' : undefined;
    return this.monetizationService.getUserSessions(userId, isActive);
  }

  @Post('/check-access')
  @HttpCode(HttpStatus.OK)
  checkMessageAccess(
    @Body()
    body: {
      senderId: string;
      recipientId: string;
      contentType: string;
      durationSeconds?: number;
    },
  ) {
    if (!body.senderId || !body.recipientId) {
      throw new BadRequestException('Both user IDs are required');
    }
    return this.monetizationService.canSendMessage(
      body.senderId,
      body.recipientId,
      body.contentType as any,
      body.durationSeconds,
    );
  }

  @Get('/:userId/balance')
  @HttpCode(HttpStatus.OK)
  getUserBalance(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.getUserBalance(userId);
  }

  @Get('/:userId/earnings')
  @HttpCode(HttpStatus.OK)
  getEarningStats(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.getEarningStats(userId);
  }

  @Put('/:userId/disable')
  @HttpCode(HttpStatus.OK)
  disableMonetization(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.disableMonetization(userId);
  }

  @Post('/sessions/:sessionId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelSession(
    @Param('sessionId') sessionId: string,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.cancelSession(sessionId, userId);
  }
  @Post('/sessions/:sessionId/pause')
  @HttpCode(HttpStatus.OK)
  pauseSession(
    @Param('sessionId') sessionId: string,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.monetizationService.pauseSession(sessionId, userId);
  }

  @Post('/sessions/:sessionId/activate')
  @HttpCode(HttpStatus.OK)
  activateSession(@Param('sessionId') sessionId: string) {
    return this.monetizationService.activateSession(sessionId);
  }

  @Post('/sessions/:sessionId/activity')
  @HttpCode(HttpStatus.OK)
  updateSessionActivity(@Param('sessionId') sessionId: string) {
    return this.monetizationService.updateSessionActivity(sessionId);
  }

  // Cron job endpoint (protect this in production!)
  @Post('/sessions/auto-pause')
  @HttpCode(HttpStatus.OK)
  autoPauseInactiveSessions(
    @Body('inactivityMinutes') inactivityMinutes?: number,
  ) {
    return this.monetizationService.autoPauseInactiveSessions(
      inactivityMinutes,
    );
  }
}
