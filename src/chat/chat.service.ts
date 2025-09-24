import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { ChatRoom, Message, MessageType } from '@prisma/client';
import { User } from '@clerk/backend';

export interface ChatRoomWithMessages extends ChatRoom {
  messages: Message[];
  participantsInfo?: {
    [userId: string]: {
      id: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string;
    };
  };
}

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
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private userSockets: Map<string, string> = new Map();
  private socketUsers: Map<string, string> = new Map();

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

  private orderParticipants(
    userId1: string,
    userId2: string,
  ): [string, string] {
    return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  }

  // async canUsersChat(userId1: string, userId2: string): Promise<boolean> {
  //   try {
  //     const [user1CanChat, user2CanChat] = await Promise.all([
  //       this.userService.isInChatList(userId1, userId2),
  //       this.userService.isInChatList(userId2, userId1),
  //     ]);

  //     return user1CanChat && user2CanChat;
  //   } catch (error) {
  //     return false;
  //   }
  // }

  async canInitiateChat(
    initiatorId: string,
    recipientId: string,
  ): Promise<boolean> {
    try {
      return await this.userService.isInChatList(initiatorId, recipientId);
    } catch (error) {
      this.logger.error(
        `Error checking chat permission for ${initiatorId} -> ${recipientId}:`,
        error,
      );
      return false;
    }
  }

  registerUserSocket(userId: string, socketId: string): void {
    const oldSocketId = this.userSockets.get(userId);
    if (oldSocketId) {
      this.socketUsers.delete(oldSocketId);
    }

    this.userSockets.set(userId, socketId);
    this.socketUsers.set(socketId, userId);
  }

  unregisterUserSocket(socketId: string): string | undefined {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(socketId);
    }
    return userId;
  }

  getUserIdFromSocket(socketId: string): string | undefined {
    return this.socketUsers.get(socketId);
  }

  getSocketIdFromUser(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  async createChatRoom(
    userId: string,
    recipientId: string,
  ): Promise<ChatRoomWithMessages> {
    if (userId === recipientId) {
      throw new BadRequestException('Cannot create chat room with yourself');
    }

    const canChat = await this.canInitiateChat(userId, recipientId);
    if (!canChat) {
      throw new ForbiddenException(
        'You must follow the user to start a chat with them.',
      );
    }

    const [participant1, participant2] = this.orderParticipants(
      userId,
      recipientId,
    );

    let chatRoom = await this.prisma.chatRoom.findUnique({
      where: {
        participant1_participant2: {
          participant1,
          participant2,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    if (chatRoom) {
      if (!chatRoom.isActive) {
        chatRoom = await this.prisma.chatRoom.update({
          where: { id: chatRoom.id },
          data: {
            isActive: true,
            lastActivity: new Date(),
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 50,
            },
          },
        });
      }
    } else {
      chatRoom = await this.prisma.chatRoom.create({
        data: {
          participant1,
          participant2,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    const [user, recipient] = await Promise.all([
      this.userService.getUser(userId),
      this.userService.getUser(recipientId),
    ]);

    const roomWithInfo: ChatRoomWithMessages = {
      ...chatRoom,
      participantsInfo: {
        [userId]: this.extractUserInfo(user),
        [recipientId]: this.extractUserInfo(recipient),
      },
    };

    return roomWithInfo;
  }

  async getChatRoom(roomId: string): Promise<ChatRoomWithMessages | null> {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chatRoom) {
      return null;
    }

    const [user1, user2] = await Promise.all([
      this.userService.getUser(chatRoom.participant1),
      this.userService.getUser(chatRoom.participant2),
    ]);

    return {
      ...chatRoom,
      participantsInfo: {
        [chatRoom.participant1]: this.extractUserInfo(user1),
        [chatRoom.participant2]: this.extractUserInfo(user2),
      },
    };
  }

  async getActiveChatRoom(
    userId1: string,
    userId2: string,
  ): Promise<ChatRoomWithMessages | null> {
    const [participant1, participant2] = this.orderParticipants(
      userId1,
      userId2,
    );

    const chatRoom = await this.prisma.chatRoom.findFirst({
      where: {
        participant1,
        participant2,
        isActive: true,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chatRoom) {
      return null;
    }

    const [user1, user2] = await Promise.all([
      this.userService.getUser(chatRoom.participant1),
      this.userService.getUser(chatRoom.participant2),
    ]);

    return {
      ...chatRoom,
      participantsInfo: {
        [chatRoom.participant1]: this.extractUserInfo(user1),
        [chatRoom.participant2]: this.extractUserInfo(user2),
      },
    };
  }

  async sendMessage(
    senderId: string,
    roomId: string,
    message: string,
    messageType: MessageType = MessageType.TEXT,
    repliedToId?: string,
  ): Promise<MessageWithSender> {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!chatRoom) throw new NotFoundException('Chat room not found');
    if (!chatRoom.isActive)
      throw new BadRequestException('Chat room is closed');
    if (
      chatRoom.participant1 !== senderId &&
      chatRoom.participant2 !== senderId
    ) {
      throw new ForbiddenException(
        'You are not a participant in this chat room',
      );
    }

    const [newMessage] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          chatRoomId: roomId,
          senderId,
          message,
          messageType,
          repliedToId,
        },
        include: { repliedTo: true },
      }),
      this.prisma.chatRoom.update({
        where: { id: roomId },
        data: { lastActivity: new Date() },
      }),
    ]);

    const sender = await this.userService.getUser(senderId);
    let repliedToSenderInfo:
      | ReturnType<typeof this.extractUserInfo>
      | undefined = undefined;
    if (newMessage.repliedTo) {
      const repliedToSender = await this.userService.getUser(
        newMessage.repliedTo.senderId,
      );
      repliedToSenderInfo = this.extractUserInfo(repliedToSender);
    }

    return {
      ...newMessage,
      senderInfo: this.extractUserInfo(sender),
      repliedTo: newMessage.repliedTo
        ? {
            ...newMessage.repliedTo,
            senderInfo: repliedToSenderInfo,
          }
        : undefined,
    };
  }

  async editMessage(
    userId: string,
    messageId: string,
    newMessage: string,
  ): Promise<MessageWithSender> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { chatRoom: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit deleted message');
    }

    const [updatedMessage] = await this.prisma.$transaction([
      this.prisma.message.update({
        where: { id: messageId },
        data: {
          message: newMessage,
          isEdited: true,
          editedAt: new Date(),
        },
      }),
      this.prisma.chatRoom.update({
        where: { id: message.chatRoomId },
        data: { lastActivity: new Date() },
      }),
    ]);

    const sender = await this.userService.getUser(userId);

    return {
      ...updatedMessage,
      senderInfo: this.extractUserInfo(sender),
    };
  }

  async deleteMessage(
    userId: string,
    messageId: string,
  ): Promise<MessageWithSender> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { chatRoom: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const [deletedMessage] = await this.prisma.$transaction([
      this.prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          message: 'This message was deleted',
        },
      }),
      this.prisma.chatRoom.update({
        where: { id: message.chatRoomId },
        data: { lastActivity: new Date() },
      }),
    ]);

    const sender = await this.userService.getUser(userId);

    return {
      ...deletedMessage,
      senderInfo: this.extractUserInfo(sender),
    };
  }

  async closeChatRoom(userId: string, roomId: string): Promise<ChatRoom> {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      throw new NotFoundException('Chat room not found');
    }

    if (chatRoom.participant1 !== userId && chatRoom.participant2 !== userId) {
      throw new ForbiddenException(
        'You are not a participant in this chat room',
      );
    }

    return await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        isActive: false,
        lastActivity: new Date(),
      },
    });
  }

  async getChatHistory(
    roomId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<MessageWithSender[]> {
    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { repliedTo: true },
    });

    const senderIds = new Set<string>();
    messages.forEach((msg) => {
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

    const formattedMessages = messages.map((message) => ({
      ...message,
      senderInfo: sendersMap.get(message.senderId),
      repliedTo: message.repliedTo
        ? {
            ...message.repliedTo,
            senderInfo: sendersMap.get(message.repliedTo.senderId),
          }
        : undefined,
    }));
    return formattedMessages.reverse();
  }

  async getUserActiveChatRooms(
    userId: string,
  ): Promise<ChatRoomWithMessages[]> {
    const chatRooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: [{ participant1: userId }, { participant2: userId }],
        isActive: true,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastActivity: 'desc' },
    });

    const participantIds = new Set<string>();
    chatRooms.forEach((room) => {
      participantIds.add(room.participant1);
      participantIds.add(room.participant2);
    });

    const participants = await Promise.all(
      Array.from(participantIds).map((id) => this.userService.getUser(id)),
    );

    const participantsMap = new Map(
      participants.map((participant) => [
        participant.id,
        this.extractUserInfo(participant),
      ]),
    );

    return chatRooms.map((room) => ({
      ...room,
      participantsInfo: {
        [room.participant1]: participantsMap.get(room.participant1)!,
        [room.participant2]: participantsMap.get(room.participant2)!,
      },
    }));
  }

  async getUserAllChatRooms(userId: string): Promise<ChatRoomWithMessages[]> {
    const chatRooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: [{ participant1: userId }, { participant2: userId }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastActivity: 'desc' },
    });

    const participantIds = new Set<string>();
    chatRooms.forEach((room) => {
      participantIds.add(room.participant1);
      participantIds.add(room.participant2);
    });

    const participants = await Promise.all(
      Array.from(participantIds).map((id) => this.userService.getUser(id)),
    );

    const participantsMap = new Map(
      participants.map((participant) => [
        participant.id,
        this.extractUserInfo(participant),
      ]),
    );

    return chatRooms.map((room) => ({
      ...room,
      participantsInfo: {
        [room.participant1]: participantsMap.get(room.participant1)!,
        [room.participant2]: participantsMap.get(room.participant2)!,
      },
    }));
  }

  async getMessageCount(roomId: string): Promise<number> {
    return await this.prisma.message.count({
      where: {
        chatRoomId: roomId,
        isDeleted: false,
      },
    });
  }

  async getUnreadMessageCount(roomId: string, userId: string): Promise<number> {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      return 0;
    }

    const otherParticipant =
      chatRoom.participant1 === userId
        ? chatRoom.participant2
        : chatRoom.participant1;

    return await this.prisma.message.count({
      where: {
        chatRoomId: roomId,
        senderId: otherParticipant,
        isDeleted: false,
      },
    });
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
