import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ServiceRequestService } from './service-request.service';
import { ServiceType, ServiceRequestStatus } from '@prisma/client';
import { AuthGuardService } from 'src/auth-guard/auth-guard.service';


interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    [key: string]: any;
  };
}


class CreateServiceRequestDto {
  providerId: string;
  serviceType: ServiceType;
  duration: number;
  message?: string;
}

class RespondToRequestDto {
  accept: boolean;
  reason?: string;
}

@Controller('api/v1/service-requests')
@UseGuards(AuthGuardService)
export class ServiceRequestController {
  constructor(
    private readonly serviceRequestService: ServiceRequestService,
  ) {}

  /**
   * Create a new service request
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.serviceRequestService.createServiceRequest(
      req.user.id,
      dto,
    );
  }

  /**
   * Respond to a service request (accept/reject)
   */
  @Patch(':requestId/respond')
  @HttpCode(HttpStatus.OK)
  async respondToRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
    @Body() dto: RespondToRequestDto,
  ) {
    return this.serviceRequestService.respondToRequest(
      req.user.id,
      requestId,
      dto,
    );
  }

  /**
   * Cancel a pending service request
   */
  @Patch(':requestId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
  ) {
    return this.serviceRequestService.cancelRequest(
      req.user.id,
      requestId,
    );
  }

  /**
   * Get pending requests received (for providers)
   */
  @Get('pending/received')
  @HttpCode(HttpStatus.OK)
  async getPendingRequests(@Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.getPendingRequests(req.user.id);
  }

  /**
   * Get sent requests (for requesters)
   */
  @Get('sent')
  @HttpCode(HttpStatus.OK)
  async getSentRequests(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: ServiceRequestStatus,
  ) {
    return this.serviceRequestService.getSentRequests(req.user.id, status);
  }

  /**
   * Get user's notifications
   */
  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  async getNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceRequestService.getNotifications(
      req.user.id,
      unreadOnly === 'true',
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * Mark notification as read
   */
  @Patch('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markNotificationRead(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.serviceRequestService.markNotificationRead(
      req.user.id,
      notificationId,
    );
  }

  /**
   * Mark all notifications as read
   */
  @Patch('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllNotificationsRead(@Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.markAllNotificationsRead(req.user.id);
  }

  /**
   * Get user's pending balance
   */
  @Get('balance/pending')
  @HttpCode(HttpStatus.OK)
  async getPendingBalance(@Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.getPendingBalance(req.user.id);
  }

  /**
   * Get transaction history
   */
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  async getTransactionHistory(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceRequestService.getTransactionHistory(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * Get request statistics
   */
  @Get('stats/:userType')
  @HttpCode(HttpStatus.OK)
  async getRequestStats(
    @Req() req: AuthenticatedRequest,
    @Param('userType') userType: 'requester' | 'provider',
  ) {
    return this.serviceRequestService.getRequestStats(
      req.user.id,
      userType,
    );
  }

  /**
   * Manual trigger to expire old requests (admin only)
   */
  @Post('admin/expire-old')
  @HttpCode(HttpStatus.OK)
  async expireOldRequests() {
    return this.serviceRequestService.autoExpireOldRequests();
  }
}