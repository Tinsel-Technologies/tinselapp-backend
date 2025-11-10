import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceType, ServiceRequestStatus } from '@prisma/client';

interface CreateServiceRequestDto {
  providerId: string;
  serviceType: ServiceType;
  duration: number;
  message?: string;
}

interface RespondToRequestDto {
  accept: boolean;
  reason?: string;
}

@Injectable()
export class ServiceRequestService {
  private readonly logger = new Logger(ServiceRequestService.name);
  private readonly EXPIRATION_DAYS = 7;

  constructor(private readonly prisma: PrismaService) {}

  async createServiceRequest(
    requesterId: string,
    dto: CreateServiceRequestDto,
  ) {
    if (requesterId === dto.providerId) {
      throw new BadRequestException('Cannot request service from yourself');
    }

    const providerSettings =
      await this.prisma.userMonetizationSettings.findUnique({
        where: { userId: dto.providerId },
        include: { chatTimeTiers: true },
      });

    if (!providerSettings || !providerSettings.isEnabled) {
      throw new BadRequestException('Service provider not available');
    }

    let price = 0;
    if (dto.serviceType === 'CHAT') {
      const tier = providerSettings.chatTimeTiers.find(
        (t) => t.durationMinutes === dto.duration && t.isActive,
      );
      if (!tier) {
        throw new BadRequestException(`No pricing for ${dto.duration} minutes`);
      }
      price = tier.price;
    } else {
      const baseRate =
        dto.serviceType === 'VIDEO'
          ? providerSettings.videoPrice || 0
          : dto.serviceType === 'IMAGE'
            ? providerSettings.imagePrice || 0
            : providerSettings.voiceNotePrice || 0;
      price = baseRate;
    }

    const requesterBalance = await this.prisma.userBalance.findUnique({
      where: { userId: requesterId },
    });

    if (!requesterBalance || requesterBalance.availableBalance < price) {
      throw new BadRequestException(
        `Insufficient balance. Required: ${providerSettings.currency} ${price}`,
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {

        const request = await tx.serviceRequest.create({
          data: {
            requesterId,
            providerId: dto.providerId,
            serviceType: dto.serviceType,
            duration: dto.duration,
            price,
            currency: providerSettings.currency,
            message: dto.message,
          },
        });

        await tx.pendingBalance.create({
          data: {
            userId: requesterId,
            amount: price,
            currency: providerSettings.currency,
            status: 'LOCKED',
            sourceType: 'SERVICE_REQUEST',
            sourceId: request.id,
            description: `Locked funds for ${dto.serviceType} request`,
          },
        });

        await tx.userBalance.update({
          where: { userId: requesterId },
          data: {
            availableBalance: { decrement: price },
            pendingBalance: { increment: price },
          },
        });

        const currentBalance = await tx.userBalance.findUnique({
          where: { userId: requesterId },
        });

        await tx.serviceTransaction.create({
          data: {
            userId: requesterId,
            requestId: request.id,
            transactionType: 'LOCK',
            amount: price,
            currency: providerSettings.currency,
            previousBalance: requesterBalance.availableBalance,
            newBalance: currentBalance!.availableBalance,
            description: `Locked ${price} for ${dto.serviceType} request`,
            metadata: {
              serviceType: dto.serviceType,
              duration: dto.duration,
              providerId: dto.providerId,
            },
          },
        });

        await tx.serviceNotification.create({
          data: {
            userId: dto.providerId,
            requestId: request.id,
            notificationType: 'SERVICE_REQUEST',
            title: `New ${dto.serviceType} Request`,
            message:
              dto.message ||
              `User wants to ${dto.serviceType.toLowerCase()} for ${dto.duration} minutes`,
            metadata: {
              requesterId,
              serviceType: dto.serviceType,
              duration: dto.duration,
              price,
            },
          },
        });

        return request;
      });

      this.logger.log(
        `Service request created: ${result.id} (${dto.serviceType})`,
      );

      return {
        success: true,
        request: result,
        message: 'Service request sent successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create service request:', error);
      throw new BadRequestException('Failed to create service request');
    }
  }

  async respondToRequest(
    providerId: string,
    requestId: string,
    dto: RespondToRequestDto,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.providerId !== providerId) {
      throw new ForbiddenException('Not authorized');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request already processed');
    }

    // Check if request is older than 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - this.EXPIRATION_DAYS);

    if (request.createdAt < weekAgo) {
      await this.expireRequest(requestId);
      throw new BadRequestException('Request has expired (older than 7 days)');
    }

    try {
      if (dto.accept) {
        return await this.acceptRequest(request);
      } else {
        return await this.rejectRequest(request, dto.reason);
      }
    } catch (error) {
      this.logger.error('Failed to respond to request:', error);
      throw new BadRequestException('Failed to process response');
    }
  }

  private async acceptRequest(request: any) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Update request status
      const updatedRequest = await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });

      // Release pending balance to provider
      const pendingBalance = await tx.pendingBalance.findFirst({
        where: {
          userId: request.requesterId,
          sourceId: request.id,
          status: 'LOCKED',
        },
      });

      if (pendingBalance) {
        await tx.pendingBalance.update({
          where: { id: pendingBalance.id },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
          },
        });

        // Update requester balance
        const requesterBalance = await tx.userBalance.findUnique({
          where: { userId: request.requesterId },
        });

        await tx.userBalance.update({
          where: { userId: request.requesterId },
          data: {
            pendingBalance: { decrement: request.price },
          },
        });

        // Record transaction for requester
        await tx.serviceTransaction.create({
          data: {
            userId: request.requesterId,
            requestId: request.id,
            transactionType: 'PAYMENT',
            amount: request.price,
            currency: request.currency,
            previousBalance: requesterBalance!.availableBalance,
            newBalance: requesterBalance!.availableBalance,
            description: `Payment for ${request.serviceType} session`,
          },
        });

        // Update provider balance
        const providerBalance = await tx.userBalance.findUnique({
          where: { userId: request.providerId },
        });

        await tx.userBalance.upsert({
          where: { userId: request.providerId },
          update: {
            availableBalance: { increment: request.price },
            totalEarnings: { increment: request.price },
          },
          create: {
            userId: request.providerId,
            availableBalance: request.price,
            totalEarnings: request.price,
          },
        });

        // Record transaction for provider
        const newProviderBalance = await tx.userBalance.findUnique({
          where: { userId: request.providerId },
        });

        await tx.serviceTransaction.create({
          data: {
            userId: request.providerId,
            requestId: request.id,
            transactionType: 'EARNING',
            amount: request.price,
            currency: request.currency,
            previousBalance: providerBalance?.availableBalance || 0,
            newBalance: newProviderBalance!.availableBalance,
            description: `Earned from ${request.serviceType} session`,
          },
        });
      }

      // Create service session
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + request.duration * 60000);

      const session = await tx.serviceSession.create({
        data: {
          requestId: request.id,
          requesterId: request.requesterId,
          providerId: request.providerId,
          serviceType: request.serviceType,
          duration: request.duration,
          price: request.price,
          currency: request.currency,
          startTime,
          endTime,
          isPaid: true,
          paidAt: new Date(),
        },
      });

      // Notify requester
      await tx.serviceNotification.create({
        data: {
          userId: request.requesterId,
          requestId: request.id,
          notificationType: 'REQUEST_ACCEPTED',
          title: 'Request Accepted',
          message: `Your ${request.serviceType} request has been accepted`,
          metadata: { sessionId: session.id },
        },
      });

      // Notify provider
      await tx.serviceNotification.create({
        data: {
          userId: request.providerId,
          requestId: request.id,
          notificationType: 'SESSION_STARTED',
          title: 'Session Started',
          message: `${request.serviceType} session has started`,
          metadata: { sessionId: session.id },
        },
      });

      return { request: updatedRequest, session };
    });

    this.logger.log(
      `Request accepted: ${request.id}, Session: ${result.session.id}`,
    );

    return {
      success: true,
      message: 'Request accepted successfully',
      session: result.session,
    };
  }

  private async rejectRequest(request: any, reason?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Update request
      const updatedRequest = await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          respondedAt: new Date(),
        },
      });

      // Refund locked balance
      const pendingBalance = await tx.pendingBalance.findFirst({
        where: {
          userId: request.requesterId,
          sourceId: request.id,
          status: 'LOCKED',
        },
      });

      if (pendingBalance) {
        await tx.pendingBalance.update({
          where: { id: pendingBalance.id },
          data: {
            status: 'REFUNDED',
            releasedAt: new Date(),
          },
        });

        const requesterBalance = await tx.userBalance.findUnique({
          where: { userId: request.requesterId },
        });

        await tx.userBalance.update({
          where: { userId: request.requesterId },
          data: {
            availableBalance: { increment: request.price },
            pendingBalance: { decrement: request.price },
          },
        });

        // Record refund transaction
        const newBalance = await tx.userBalance.findUnique({
          where: { userId: request.requesterId },
        });

        await tx.serviceTransaction.create({
          data: {
            userId: request.requesterId,
            requestId: request.id,
            transactionType: 'REFUND',
            amount: request.price,
            currency: request.currency,
            previousBalance: requesterBalance!.availableBalance,
            newBalance: newBalance!.availableBalance,
            description: `Refund for rejected ${request.serviceType} request`,
          },
        });
      }

      // Notify requester
      await tx.serviceNotification.create({
        data: {
          userId: request.requesterId,
          requestId: request.id,
          notificationType: 'REQUEST_REJECTED',
          title: 'Request Rejected',
          message: reason || `Your ${request.serviceType} request was rejected`,
          metadata: { reason },
        },
      });

      return updatedRequest;
    });

    this.logger.log(`Request rejected: ${request.id}`);

    return {
      success: true,
      message: 'Request rejected',
    };
  }

  private async expireRequest(requestId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'PENDING') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: 'EXPIRED',
          respondedAt: new Date(),
        },
      });

      // Refund locked balance
      const pendingBalance = await tx.pendingBalance.findFirst({
        where: {
          userId: request.requesterId,
          sourceId: requestId,
          status: 'LOCKED',
        },
      });

      if (pendingBalance) {
        await tx.pendingBalance.update({
          where: { id: pendingBalance.id },
          data: {
            status: 'EXPIRED',
            releasedAt: new Date(),
          },
        });

        const requesterBalance = await tx.userBalance.findUnique({
          where: { userId: request.requesterId },
        });

        await tx.userBalance.update({
          where: { userId: request.requesterId },
          data: {
            availableBalance: { increment: request.price },
            pendingBalance: { decrement: request.price },
          },
        });

        // Record refund transaction
        const newBalance = await tx.userBalance.findUnique({
          where: { userId: request.requesterId },
        });

        await tx.serviceTransaction.create({
          data: {
            userId: request.requesterId,
            requestId: request.id,
            transactionType: 'REFUND',
            amount: request.price,
            currency: request.currency,
            previousBalance: requesterBalance!.availableBalance,
            newBalance: newBalance!.availableBalance,
            description: `Refund for expired ${request.serviceType} request`,
          },
        });
      }

      // Notify both parties
      await tx.serviceNotification.createMany({
        data: [
          {
            userId: request.requesterId,
            requestId,
            notificationType: 'REQUEST_EXPIRED',
            title: 'Request Expired',
            message: 'Your service request has expired (7 days)',
          },
          {
            userId: request.providerId,
            requestId,
            notificationType: 'REQUEST_EXPIRED',
            title: 'Request Expired',
            message: 'Service request has expired (7 days)',
          },
        ],
      });
    });

    this.logger.log(`Request expired: ${requestId}`);
  }

  async cancelRequest(requesterId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.requesterId !== requesterId) {
      throw new ForbiddenException('Not authorized');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel pending requests');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: 'CANCELLED',
          respondedAt: new Date(),
        },
      });

      // Refund locked balance
      const pendingBalance = await tx.pendingBalance.findFirst({
        where: {
          userId: requesterId,
          sourceId: requestId,
          status: 'LOCKED',
        },
      });

      if (pendingBalance) {
        await tx.pendingBalance.update({
          where: { id: pendingBalance.id },
          data: {
            status: 'REFUNDED',
            releasedAt: new Date(),
          },
        });

        const requesterBalance = await tx.userBalance.findUnique({
          where: { userId: requesterId },
        });

        await tx.userBalance.update({
          where: { userId: requesterId },
          data: {
            availableBalance: { increment: request.price },
            pendingBalance: { decrement: request.price },
          },
        });

        const newBalance = await tx.userBalance.findUnique({
          where: { userId: requesterId },
        });

        await tx.serviceTransaction.create({
          data: {
            userId: requesterId,
            requestId: request.id,
            transactionType: 'REFUND',
            amount: request.price,
            currency: request.currency,
            previousBalance: requesterBalance!.availableBalance,
            newBalance: newBalance!.availableBalance,
            description: `Refund for cancelled ${request.serviceType} request`,
          },
        });
      }

      // Notify provider
      await tx.serviceNotification.create({
        data: {
          userId: request.providerId,
          requestId,
          notificationType: 'REQUEST_EXPIRED',
          title: 'Request Cancelled',
          message: 'User cancelled their service request',
        },
      });
    });

    this.logger.log(`Request cancelled by user: ${requestId}`);

    return {
      success: true,
      message: 'Request cancelled successfully',
    };
  }

  // Get user's notifications
  async getNotifications(
    userId: string,
    unreadOnly: boolean = false,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.serviceNotification.findMany({
        where,
        include: {
          request: {
            select: {
              id: true,
              serviceType: true,
              duration: true,
              price: true,
              status: true,
              requesterId: true,
              providerId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.serviceNotification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Mark notification as read
  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await this.prisma.serviceNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.serviceNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // Mark all notifications as read
  async markAllNotificationsRead(userId: string) {
    const result = await this.prisma.serviceNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }

  // Get pending requests (for providers)
  async getPendingRequests(providerId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - this.EXPIRATION_DAYS);

    return this.prisma.serviceRequest.findMany({
      where: {
        providerId,
        status: 'PENDING',
        createdAt: { gte: weekAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get user's sent requests (for requesters)
  async getSentRequests(requesterId: string, status?: ServiceRequestStatus) {
    return this.prisma.serviceRequest.findMany({
      where: {
        requesterId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingBalance(userId: string) {
    const locked = await this.prisma.pendingBalance.findMany({
      where: {
        userId,
        status: 'LOCKED',
      },
    });

    const totalLocked = locked.reduce((sum, pb) => sum + pb.amount, 0);

    return {
      totalLocked,
      itemCount: locked.length,
      items: locked,
    };
  }

  // Get transaction history
  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.serviceTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.serviceTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Auto-expire old requests (run via cron - weekly)
  async autoExpireOldRequests() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - this.EXPIRATION_DAYS);

    const oldRequests = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: weekAgo },
      },
    });

    for (const request of oldRequests) {
      await this.expireRequest(request.id);
    }

    this.logger.log(
      `Expired ${oldRequests.length} requests older than ${this.EXPIRATION_DAYS} days`,
    );

    return {
      success: true,
      expiredCount: oldRequests.length,
    };
  }

  // Get request statistics
  async getRequestStats(userId: string, userType: 'requester' | 'provider') {
    const field = userType === 'requester' ? 'requesterId' : 'providerId';

    const [total, pending, accepted, rejected, expired] = await Promise.all([
      this.prisma.serviceRequest.count({
        where: { [field]: userId },
      }),
      this.prisma.serviceRequest.count({
        where: { [field]: userId, status: 'PENDING' },
      }),
      this.prisma.serviceRequest.count({
        where: { [field]: userId, status: 'ACCEPTED' },
      }),
      this.prisma.serviceRequest.count({
        where: { [field]: userId, status: 'REJECTED' },
      }),
      this.prisma.serviceRequest.count({
        where: { [field]: userId, status: 'EXPIRED' },
      }),
    ]);

    return {
      total,
      pending,
      accepted,
      rejected,
      expired,
    };
  }
}
