import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageType } from '@prisma/client';
import {
  SetMonetizationSettingsDto,
  UpdateMonetizationSettingsDto,
  MonetizationInfo,
  PurchaseChatTimeDto,
  ChatSessionInfo,
  ContentCostCalculation,
} from './dto/monetization.dto';

@Injectable()
export class MonetizationService {
  private readonly logger = new Logger(MonetizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Set user's monetization settings
   */
  async setMonetizationSettings(
    userId: string,
    dto: SetMonetizationSettingsDto,
  ) {
    if (
      dto.isEnabled &&
      (!dto.chatTimeTiers || dto.chatTimeTiers.length === 0)
    ) {
      throw new BadRequestException(
        'At least one chat time tier is required when monetization is enabled',
      );
    }

    if (dto.chatTimeTiers) {
      for (const tier of dto.chatTimeTiers) {
        if (tier.price <= 0) {
          throw new BadRequestException(
            `Price for ${tier.durationMinutes} minutes must be greater than 0`,
          );
        }
      }
    }

    if (
      dto.monetizeVoiceNotes &&
      (!dto.voiceNotePrice || dto.voiceNotePrice <= 0)
    ) {
      throw new BadRequestException(
        'Voice note price (per second) must be greater than 0',
      );
    }

    if (dto.monetizeImages && (!dto.imagePrice || dto.imagePrice <= 0)) {
      throw new BadRequestException('Image price must be greater than 0');
    }

    if (dto.monetizeVideos && (!dto.videoPrice || dto.videoPrice <= 0)) {
      throw new BadRequestException(
        'Video price (per second) must be greater than 0',
      );
    }

    try {
      const settings =
        await this.prisma.userMonetizationSettings.upsert({
          where: { userId },
          update: {
            isEnabled: dto.isEnabled,
            voiceNotePrice: dto.voiceNotePrice || 0,
            imagePrice: dto.imagePrice || 0,
            videoPrice: dto.videoPrice || 0,
            monetizeVoiceNotes: dto.monetizeVoiceNotes || false,
            monetizeImages: dto.monetizeImages || false,
            monetizeVideos: dto.monetizeVideos || false,
            currency: dto.currency || 'KES',
          },
          create: {
            userId,
            isEnabled: dto.isEnabled,
            voiceNotePrice: dto.voiceNotePrice || 0,
            imagePrice: dto.imagePrice || 0,
            videoPrice: dto.videoPrice || 0,
            monetizeVoiceNotes: dto.monetizeVoiceNotes || false,
            monetizeImages: dto.monetizeImages || false,
            monetizeVideos: dto.monetizeVideos || false,
            currency: dto.currency || 'KES',
          },
        });

      if (dto.chatTimeTiers && dto.chatTimeTiers.length > 0) {
        await this.prisma.chatTimeTier.deleteMany({
          where: { settingsId: settings.id },
        });

        await this.prisma.chatTimeTier.createMany({
          data: dto.chatTimeTiers.map((tier) => ({
            settingsId: settings.id,
            durationMinutes: tier.durationMinutes,
            price: tier.price,
            isActive: tier.isActive ?? true,
          })),
        });
      }

      this.logger.log(
        `Monetization settings updated for user ${userId}`,
      );

      return {
        success: true,
        message: 'Monetization settings updated successfully',
        settings: await this.getMonetizationSettings(userId),
      };
    } catch (error) {
      this.logger.error('Failed to update settings:', error);
      throw new InternalServerErrorException(
        'Failed to update monetization settings',
      );
    }
  }

  /**
   * Get user's monetization settings
   */
  async getMonetizationSettings(userId: string) {
    const settings =
      await this.prisma.userMonetizationSettings.findUnique({
        where: { userId },
        include: { chatTimeTiers: { where: { isActive: true } } },
      });

    if (!settings) {
      return {
        isMonetized: false,
        message: 'User has not set up monetization',
      };
    }

    return {
      isMonetized: settings.isEnabled,
      settings,
    };
  }

  /**
   * Get monetization info for display (public)
   */
  async getMonetizationInfo(userId: string): Promise<MonetizationInfo> {
    const settings =
      await this.prisma.userMonetizationSettings.findUnique({
        where: { userId },
        include: { chatTimeTiers: { where: { isActive: true } } },
      });

    if (!settings || !settings.isEnabled) {
      return { isMonetized: false };
    }

    return {
      isMonetized: true,
      settings: {
        chatTimeTiers: settings.chatTimeTiers.map((t) => ({
          durationMinutes: t.durationMinutes,
          price: t.price,
          isActive: t.isActive,
        })),
        voiceNotePrice: settings.monetizeVoiceNotes
          ? settings.voiceNotePrice
          : undefined,
        imagePrice: settings.monetizeImages
          ? settings.imagePrice
          : undefined,
        videoPrice: settings.monetizeVideos
          ? settings.videoPrice
          : undefined,
        monetizeVoiceNotes: settings.monetizeVoiceNotes,
        monetizeImages: settings.monetizeImages,
        monetizeVideos: settings.monetizeVideos,
        currency: settings.currency,
      },
    };
  }


  async canSendMessage(
    senderId: string,
    recipientId: string,
    contentType: MessageType,
    durationSeconds?: number,
  ): Promise<ContentCostCalculation> {
    const settings =
      await this.prisma.userMonetizationSettings.findUnique({
        where: { userId: recipientId },
        include: { chatTimeTiers: { where: { isActive: true } } },
      });

    if (!settings || !settings.isEnabled) {
      return {
        sessionRequired: false,
      };
    }

    const session = await this.getActiveSession(senderId, recipientId);

    if (!session || session.buyerId !== senderId) {
      return {
        sessionRequired: true,
        sessionCost: {
          availableTiers: settings.chatTimeTiers.map((t) => ({
            durationMinutes: t.durationMinutes,
            price: t.price,
          })),
        },
      };
    }

    let additionalCost;

    if (contentType === MessageType.AUDIO && settings.monetizeVoiceNotes) {
      if (!durationSeconds) {
        throw new BadRequestException(
          'Duration is required for voice notes',
        );
      }
      const total = settings.voiceNotePrice * durationSeconds;
      additionalCost = {
        contentType,
        basePrice: settings.voiceNotePrice,
        units: durationSeconds,
        totalCost: total,
        currency: settings.currency,
        description: `${durationSeconds} seconds @ ${settings.currency} ${settings.voiceNotePrice}/sec = ${settings.currency} ${total.toFixed(2)}`,
      };
    } else if (
      contentType === MessageType.IMAGE &&
      settings.monetizeImages
    ) {
      additionalCost = {
        contentType,
        basePrice: settings.imagePrice,
        units: 1,
        totalCost: settings.imagePrice,
        currency: settings.currency,
        description: `1 image @ ${settings.currency} ${settings.imagePrice.toFixed(2)}`,
      };
    } else if (
      contentType === MessageType.VIDEO &&
      settings.monetizeVideos
    ) {
      if (!durationSeconds) {
        throw new BadRequestException('Duration is required for videos');
      }
      const total = settings.videoPrice * durationSeconds;
      additionalCost = {
        contentType,
        basePrice: settings.videoPrice,
        units: durationSeconds,
        totalCost: total,
        currency: settings.currency,
        description: `${durationSeconds} seconds @ ${settings.currency} ${settings.videoPrice}/sec = ${settings.currency} ${total.toFixed(2)}`,
      };
    }

    
    if (additionalCost) {
      const senderBalance = await this.prisma.userBalance.findUnique({
        where: { userId: senderId },
      });

      if (
        !senderBalance ||
        senderBalance.availableBalance < additionalCost.totalCost
      ) {
        throw new BadRequestException(
          `Insufficient balance for ${contentType}. Required: ${additionalCost.currency} ${additionalCost.totalCost}, Available: ${additionalCost.currency} ${senderBalance?.availableBalance || 0}`,
        );
      }
    }

    return {
      sessionRequired: false,
      additionalCost,
    };
  }

  /**
   * Create content charge and deduct from sender's wallet
   */
  async createContentCharge(
    messageId: string,
    sessionId: string,
    senderId: string,
    recipientId: string,
    contentType: MessageType,
    durationSeconds?: number,
  ) {
    const settings =
      await this.prisma.userMonetizationSettings.findUnique({
        where: { userId: recipientId },
      });

    if (!settings || !settings.isEnabled) {
      return null;
    }

    let basePrice = 0;
    let units = 0;
    let totalAmount = 0;

    if (contentType === MessageType.TEXT) {
      return null;
    } else if (
      contentType === MessageType.AUDIO &&
      settings.monetizeVoiceNotes
    ) {
      if (!durationSeconds) {
        throw new BadRequestException(
          'Duration required for voice notes',
        );
      }
      basePrice = settings.voiceNotePrice;
      units = durationSeconds;
      totalAmount = basePrice * units;
    } else if (
      contentType === MessageType.IMAGE &&
      settings.monetizeImages
    ) {
      basePrice = settings.imagePrice;
      units = 1;
      totalAmount = basePrice;
    } else if (
      contentType === MessageType.VIDEO &&
      settings.monetizeVideos
    ) {
      if (!durationSeconds) {
        throw new BadRequestException('Duration required for videos');
      }
      basePrice = settings.videoPrice;
      units = durationSeconds;
      totalAmount = basePrice * units;
    } else {
      return null;
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        
        const senderBalance = await tx.userBalance.findUnique({
          where: { userId: senderId },
        });

        if (
          !senderBalance ||
          senderBalance.availableBalance < totalAmount
        ) {
          throw new BadRequestException(
            `Insufficient balance. Required: ${settings.currency} ${totalAmount}`,
          );
        }

        
        await tx.userBalance.update({
          where: { userId: senderId },
          data: {
            availableBalance: { decrement: totalAmount },
            totalSpent: { increment: totalAmount },
            lastUpdated: new Date(),
          },
        });

        
        await tx.userBalance.upsert({
          where: { userId: recipientId },
          update: {
            availableBalance: { increment: totalAmount },
            totalEarnings: { increment: totalAmount },
            lastUpdated: new Date(),
          },
          create: {
            userId: recipientId,
            availableBalance: totalAmount,
            totalEarnings: totalAmount,
          },
        });

        
        const charge = await tx.contentCharge.create({
          data: {
            messageId,
            sessionId,
            senderId,
            recipientId,
            contentType,
            basePrice,
            units,
            totalAmount,
            isPaid: true,
            paidAt: new Date(),
          },
        });

        return charge;
      });

      this.logger.log(
        `Content charge processed: ${contentType} = ${settings.currency} ${totalAmount.toFixed(2)}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Failed to create content charge:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to process content charge',
      );
    }
  }


  async getUserBalance(userId: string) {
    const balance = await this.prisma.userBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      return {
        availableBalance: 0,
        pendingBalance: 0,
        totalEarnings: 0,
        totalSpent: 0,
        currency: 'KES',
      };
    }

    return balance;
  }

  async getUserSessions(userId: string, isActive?: boolean) {
    const where: any = {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      isCancelled: false,
    };

    if (isActive !== undefined) {
      if (isActive) {
        where.isActive = true;
        where.endTime = { gt: new Date() };
      } else {
        where.OR = [
          { isActive: false },
          { endTime: { lte: new Date() } },
        ];
      }
    }

    const sessions = await this.prisma.chatSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => this.formatChatSessionInfo(s));
  }

  async getEarningStats(userId: string) {
    const balance = await this.getUserBalance(userId);

    const sessions = await this.prisma.chatSession.findMany({
      where: { sellerId: userId },
    });

    const charges = await this.prisma.contentCharge.findMany({
      where: { recipientId: userId },
    });

    return {
      balance,
      totalSessions: sessions.length,
      activeSessions: sessions.filter(
        (s) => s.isActive && s.endTime > new Date(),
      ).length,
      sessionEarnings: sessions.reduce((sum, s) => sum + s.price, 0),
      additionalCharges: charges.reduce(
        (sum, c) => sum + c.totalAmount,
        0,
      ),
    };
  }

  async disableMonetization(userId: string) {
    try {
      const settings = await this.prisma.userMonetizationSettings.update({
        where: { userId },
        data: { isEnabled: false },
      });

      return {
        success: true,
        message: 'Monetization disabled successfully',
        settings,
      };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Monetization settings not found');
      }
      throw new InternalServerErrorException(
        'Failed to disable monetization',
      );
    }
  }

  /**
   * Cancel active session and refund remaining time
   */
  

    async purchaseChatTime(
    buyerId: string,
    dto: PurchaseChatTimeDto,
  ): Promise<ChatSessionInfo> {
    const settings =
      await this.prisma.userMonetizationSettings.findUnique({
        where: { userId: dto.sellerId },
        include: { chatTimeTiers: true },
      });

    if (!settings || !settings.isEnabled) {
      throw new BadRequestException(
        'This user does not have monetization enabled',
      );
    }

    const tier = settings.chatTimeTiers.find(
      (t) => t.durationMinutes === dto.durationMinutes && t.isActive,
    );

    if (!tier) {
      throw new BadRequestException(
        `No pricing tier found for ${dto.durationMinutes} minutes`,
      );
    }

    
    const existingSession = await this.prisma.chatSession.findFirst({
      where: {
        buyerId,
        sellerId: dto.sellerId,
        isActive: true,
        isCancelled: false,
      },
    });

    if (existingSession && existingSession.usedMinutes < existingSession.durationMinutes) {
      throw new BadRequestException(
        `You already have an active session with ${existingSession.durationMinutes - existingSession.usedMinutes} minutes remaining`,
      );
    }

    const buyerBalance = await this.prisma.userBalance.findUnique({
      where: { userId: buyerId },
    });

    if (!buyerBalance || buyerBalance.availableBalance < tier.price) {
      throw new BadRequestException(
        `Insufficient balance. Required: ${settings.currency} ${tier.price}, Available: ${settings.currency} ${buyerBalance?.availableBalance || 0}`,
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.userBalance.update({
          where: { userId: buyerId },
          data: {
            availableBalance: { decrement: tier.price },
            totalSpent: { increment: tier.price },
            lastUpdated: new Date(),
          },
        });

        await tx.userBalance.upsert({
          where: { userId: dto.sellerId },
          update: {
            availableBalance: { increment: tier.price },
            totalEarnings: { increment: tier.price },
            lastUpdated: new Date(),
          },
          create: {
            userId: dto.sellerId,
            availableBalance: tier.price,
            totalEarnings: tier.price,
          },
        });

        const startTime = new Date();
        
        const session = await tx.chatSession.create({
          data: {
            buyerId,
            sellerId: dto.sellerId,
            durationMinutes: tier.durationMinutes,
            price: tier.price,
            currency: settings.currency,
            startTime,
            endTime: startTime, 
            isPaid: true,
            paidAt: new Date(),
            isActive: true,
            usedMinutes: 0,
            isPaused: true, 
          },
        });

        return session;
      });

      this.logger.log(
        `Chat session purchased: ${buyerId} -> ${dto.sellerId} for ${tier.durationMinutes} mins @ ${settings.currency} ${tier.price}`,
      );

      return this.formatChatSessionInfo(result);
    } catch (error) {
      this.logger.error('Failed to purchase chat time:', error);
      throw new InternalServerErrorException(
        'Failed to complete purchase',
      );
    }
  }

  /**
   * Resume or activate session (called when sending first message)
   */
  async activateSession(sessionId: string): Promise<ChatSessionInfo> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (!session.isActive || session.isCancelled) {
      throw new BadRequestException('Session is not available');
    }

    const remainingMinutes = session.durationMinutes - session.usedMinutes;

    if (remainingMinutes <= 0) {
      throw new BadRequestException('Session time has been fully used');
    }

    const now = new Date();
    const newEndTime = new Date(
      now.getTime() + remainingMinutes * 60 * 1000,
    );

    const updatedSession = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isPaused: false,
        resumedAt: now,
        lastActiveAt: now,
        endTime: newEndTime,
      },
    });

    this.logger.log(
      `Session activated: ${sessionId}, remaining: ${remainingMinutes} mins`,
    );

    return this.formatChatSessionInfo(updatedSession);
  }

  /**
   * Pause session (called when user explicitly pauses or after inactivity)
   */
  async pauseSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.buyerId !== userId && session.sellerId !== userId) {
      throw new ForbiddenException(
        'You are not part of this chat session',
      );
    }

    if (session.isPaused) {
      throw new BadRequestException('Session is already paused');
    }

    
    const now = new Date();
    const lastActive = session.lastActiveAt || session.resumedAt || session.startTime;
    const minutesUsed = Math.max(
      0,
      (now.getTime() - lastActive.getTime()) / 60000,
    );

    const totalUsed = session.usedMinutes + minutesUsed;

    const updatedSession = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isPaused: true,
        pausedAt: now,
        usedMinutes: totalUsed,
      },
    });

    this.logger.log(
      `Session paused: ${sessionId}, used: ${totalUsed.toFixed(2)} mins`,
    );

    return {
      success: true,
      message: 'Session paused successfully',
      session: this.formatChatSessionInfo(updatedSession),
    };
  }

  /**
   * Update session activity (called when message is sent)
   */
  async updateSessionActivity(sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const now = new Date();

    
    if (session.isPaused) {
      return this.activateSession(sessionId);
    }

    
    if (now > session.endTime) {
      
      const lastActive = session.lastActiveAt || session.resumedAt || session.startTime;
      const minutesUsed = Math.min(
        session.durationMinutes - session.usedMinutes,
        (session.endTime.getTime() - lastActive.getTime()) / 60000,
      );

      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          usedMinutes: session.usedMinutes + minutesUsed,
          isPaused: true,
        },
      });

      throw new BadRequestException('Session time has expired');
    }

    
    const updatedSession = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        lastActiveAt: now,
      },
    });

    return this.formatChatSessionInfo(updatedSession);
  }

  /**
   * Get active session with accurate remaining time
   */
  async getActiveSession(
    userId1: string,
    userId2: string,
  ): Promise<ChatSessionInfo | null> {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        OR: [
          { buyerId: userId1, sellerId: userId2 },
          { buyerId: userId2, sellerId: userId1 },
        ],
        isActive: true,
        isCancelled: false,
      },
    });

    if (!session) {
      return null;
    }

    
    const now = new Date();
    if (!session.isPaused && now > session.endTime) {
      
      const lastActive = session.lastActiveAt || session.resumedAt || session.startTime;
      const minutesUsed = Math.min(
        session.durationMinutes - session.usedMinutes,
        (session.endTime.getTime() - lastActive.getTime()) / 60000,
      );

      await this.prisma.chatSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          usedMinutes: session.usedMinutes + minutesUsed,
          isPaused: true,
        },
      });

      return null;
    }

    return this.formatChatSessionInfo(session);
  }

  /**
   * Auto-pause session after inactivity (run via cron job)
   */
  async autoPauseInactiveSessions(inactivityMinutes: number = 5) {
    const cutoffTime = new Date(
      Date.now() - inactivityMinutes * 60 * 1000,
    );

    const inactiveSessions = await this.prisma.chatSession.findMany({
      where: {
        isActive: true,
        isPaused: false,
        lastActiveAt: { lt: cutoffTime },
      },
    });

    for (const session of inactiveSessions) {
      try {
        const now = new Date();
        const lastActive = session.lastActiveAt || session.resumedAt || session.startTime;
        const minutesUsed = (now.getTime() - lastActive.getTime()) / 60000;
        const totalUsed = session.usedMinutes + minutesUsed;

        await this.prisma.chatSession.update({
          where: { id: session.id },
          data: {
            isPaused: true,
            pausedAt: now,
            usedMinutes: totalUsed,
          },
        });

        this.logger.log(
          `Auto-paused inactive session: ${session.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to auto-pause session ${session.id}:`,
          error,
        );
      }
    }

    return {
      success: true,
      pausedCount: inactiveSessions.length,
    };
  }

  private formatChatSessionInfo(session: any): ChatSessionInfo {
    const now = new Date();
    let remaining = 0;

    if (session.isPaused) {
      
      remaining = Math.max(
        0,
        session.durationMinutes - session.usedMinutes,
      );
    } else {
      
      const lastActive = session.lastActiveAt || session.resumedAt || session.startTime;
      const currentUsage = (now.getTime() - lastActive.getTime()) / 60000;
      remaining = Math.max(
        0,
        session.durationMinutes - (session.usedMinutes + currentUsage),
      );
    }

    return {
      id: session.id,
      buyerId: session.buyerId,
      sellerId: session.sellerId,
      durationMinutes: session.durationMinutes,
      price: session.price,
      currency: session.currency,
      startTime: session.startTime,
      endTime: session.endTime,
      remainingMinutes: Math.round(remaining * 100) / 100, 
      usedMinutes: Math.round(session.usedMinutes * 100) / 100,
      isPaused: session.isPaused,
      isActive: session.isActive && remaining > 0,
      isPaid: session.isPaid,
    };
  }

  /**
   * Cancel session and refund remaining time
   */
  async cancelSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.buyerId !== userId && session.sellerId !== userId) {
      throw new ForbiddenException(
        'You are not part of this chat session',
      );
    }

    if (!session.isActive) {
      throw new BadRequestException('Session is not active');
    }

    
    const now = new Date();
    let totalUsed = session.usedMinutes;

    if (!session.isPaused) {
      const lastActive = session.lastActiveAt || session.resumedAt || session.startTime;
      const currentUsage = (now.getTime() - lastActive.getTime()) / 60000;
      totalUsed += currentUsage;
    }

    const remainingMinutes = Math.max(
      0,
      session.durationMinutes - totalUsed,
    );
    const refundAmount =
      (session.price / session.durationMinutes) * remainingMinutes;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.chatSession.update({
          where: { id: sessionId },
          data: {
            isActive: false,
            isCancelled: true,
            usedMinutes: totalUsed,
            isPaused: true,
            pausedAt: now,
          },
        });

        if (refundAmount > 0) {
          await tx.userBalance.update({
            where: { userId: session.buyerId },
            data: {
              availableBalance: { increment: refundAmount },
              totalSpent: { decrement: refundAmount },
              lastUpdated: new Date(),
            },
          });

          await tx.userBalance.update({
            where: { userId: session.sellerId },
            data: {
              availableBalance: { decrement: refundAmount },
              totalEarnings: { decrement: refundAmount },
              lastUpdated: new Date(),
            },
          });
        }
      });

      this.logger.log(
        `Session cancelled: ${sessionId}, refund: ${refundAmount}`,
      );

      return {
        success: true,
        message: 'Session cancelled successfully',
        refundAmount: Math.round(refundAmount * 100) / 100,
        usedMinutes: Math.round(totalUsed * 100) / 100,
        remainingMinutes: Math.round(remainingMinutes * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to cancel session:', error);
      throw new InternalServerErrorException(
        'Failed to cancel session',
      );
    }
  }
}