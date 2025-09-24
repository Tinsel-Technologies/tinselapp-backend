import { User } from '@clerk/backend';
import { Injectable, Logger } from '@nestjs/common';
import { Message } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';

export interface MessageWithSender extends Message {
  senderInfo?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
  };

  repliedTo?: MessageWithSender;
}
@Injectable()
export class ChatlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  private extractUserInfo(user: User | null) {
    if (!user) {
      return {
        id: 'unknown_user',
        username: 'Unknown User',
        firstName: 'Unknown',
        lastName: 'User',
        imageUrl: '',
      };
    }
    return {
      id: user.id,
      username: user.username || 'No username',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: user.imageUrl || '',
    };
  }

  private readonly logger = new Logger();

  async getChatHistory(
    roomId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ messages: MessageWithSender[]; hasMore: boolean }> {
    this.logger.log(
      `Getting chat history for room: ${roomId}, limit: ${limit}, offset: ${offset}`,
    );

    const messagesToFetch = limit + 1;

    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: roomId },
      orderBy: { createdAt: 'desc' },
      take: messagesToFetch,
      skip: offset,
      include: { repliedTo: true },
    });

    const hasMore = messages.length > limit;

    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    if (resultMessages.length === 0) {
      return { messages: [], hasMore: false };
    }

    const senderIds = new Set<string>();
    resultMessages.forEach((msg) => {
      senderIds.add(msg.senderId);
      if (msg.repliedTo) {
        senderIds.add(msg.repliedTo.senderId);
      }
    });

    const senders = await Promise.all(
      Array.from(senderIds).map((id) => this.userService.getUser(id)),
    );
    const sendersMap = new Map(
      senders.map((sender) => [sender.id, this.extractUserInfo(sender)]),
    );

    const formattedMessages = resultMessages.map((message) => ({
      ...message,
      senderInfo: sendersMap.get(message.senderId),
      repliedTo: message.repliedTo
        ? {
            ...message.repliedTo,
            senderInfo: sendersMap.get(message.repliedTo.senderId),
          }
        : undefined,
    }));

    return { messages: formattedMessages.reverse(), hasMore };
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [{ participant1: userId }, { participant2: userId }],
      },
      select: { id: true },
    });
    return !!room;
  }
}
