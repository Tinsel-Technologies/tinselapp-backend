import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsePipes, ValidationPipe, Logger, Inject } from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  CreateChatRoomDto,
  SendMessageDto,
  EditMessageDto,
  DeleteMessageDto,
  CloseChatRoomDto,
  TypingDto,
  GetChatHistoryDto,
} from './dto/chat.dto';
import { ClerkClient, User, verifyToken } from '@clerk/backend';

interface AuthenticatedSocket extends Socket {
  data: {
    user: User;
  };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
// @UseGuards(SocketAuthGuardService)
@UsePipes(new ValidationPipe())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractTokenFromClient(client);
      if (!token) {
        throw new Error('No authentication token provided');
      }

      const tokenPayload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: 60000,
      });

      const user = await this.clerkClient.users.getUser(tokenPayload.sub);
      client.data.user = user;
      const userId = user.id;

      this.chatService.registerUserSocket(userId, client.id);
      await client.join(`user_${userId}`);

      const activeChatRooms =
        await this.chatService.getUserActiveChatRooms(userId);
      for (const room of activeChatRooms) {
        await client.join(room.id);
        const otherParticipant =
          room.participant1 === userId ? room.participant2 : room.participant1;
        if (this.chatService.isUserOnline(otherParticipant)) {
          this.server
            .to(`user_${otherParticipant}`)
            .emit('userOnline', { userId, roomId: room.id });
        }
      }

      client.emit('activeChatRooms', {
        rooms: activeChatRooms.map((room) => {
          const otherParticipantId =
            room.participant1 === userId
              ? room.participant2
              : room.participant1;
          return {
            ...room,
            otherParticipant: room.participantsInfo?.[otherParticipantId],
            lastMessage: room.messages[0] || null,
          };
        }),
      });

      this.logger.log(
        `User ${userId} (${user.firstName}) connected with socket ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Authentication failed for client ${client.id}: ${error.message}`,
      );
      client.emit('auth_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.chatService.unregisterUserSocket(client.id);
    if (userId) {
      this.logger.log(`User ${userId} disconnected`);
      const activeChatRooms =
        await this.chatService.getUserActiveChatRooms(userId);
      for (const room of activeChatRooms) {
        const otherParticipant =
          room.participant1 === userId ? room.participant2 : room.participant1;
        this.server
          .to(`user_${otherParticipant}`)
          .emit('userOffline', { userId, roomId: room.id });
      }
    }
  }

  private extractTokenFromClient(client: Socket): string | null {
    const authHeader =
      client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader;
  }

  @SubscribeMessage('createChatRoom')
  async handleCreateChatRoom(
    @MessageBody() createChatRoomDto: CreateChatRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const user = client.data.user;
      const userId = user.id;

      const { recipientId } = createChatRoomDto;
      const room = await this.chatService.createChatRoom(userId, recipientId);

      await client.join(room.id);
      const recipientSocketId =
        this.chatService.getSocketIdFromUser(recipientId);
      if (recipientSocketId) {
        this.server.sockets.sockets.get(recipientSocketId)?.join(room.id);
      }

      const otherParticipantId =
        room.participant1 === userId ? room.participant2 : room.participant1;

      this.server.to(room.id).emit('chatRoomCreated', {
        room: {
          ...room,
          otherParticipant: room.participantsInfo?.[otherParticipantId],
        },
        createdBy: userId,
      });

      this.logger.log(`Chat room ${room.id} created by user ${userId}`);
      return { success: true, data: room };
    } catch (error) {
      this.logger.error('Create chat room error:', error.stack);
      return {
        success: false,
        error: error.message || 'Failed to create chat room',
      };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() sendMessageDto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const senderId = client.data.user.id;
      const { roomId, message, messageType, repliedToId, fileUrl } =
        sendMessageDto;

      if (!message?.trim() && !fileUrl) {
        return { success: false, error: 'Cannot send an empty message.' };
      }
      const chatMessage = await this.chatService.sendMessage(
        senderId,
        roomId,
        message,
        messageType,
        repliedToId,
        fileUrl,
      );

      this.server.to(roomId).emit('newMessage', {
        ...chatMessage,
        roomId,
      });

      this.logger.log(`Message sent by ${senderId} in room ${roomId}`);
      return { success: true, data: chatMessage };
    } catch (error) {
      this.logger.error(
        `Send message error for user ${client.data.user?.id}:`,
        error.stack,
      );
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() editMessageDto: EditMessageDto & { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id;
      const { roomId, messageId, newMessage } = editMessageDto;
      const editedMessage = await this.chatService.editMessage(
        userId,
        messageId,
        newMessage,
      );
      this.server
        .to(roomId)
        .emit('messageEdited', { ...editedMessage, roomId });
      return { success: true, data: editedMessage };
    } catch (error) {
      this.logger.error('Edit message error:', error.stack);
      return {
        success: false,
        error: error.message || 'Failed to edit message',
      };
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() deleteMessageDto: DeleteMessageDto & { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id;
      const { roomId, messageId } = deleteMessageDto;
      const deletedMessage = await this.chatService.deleteMessage(
        userId,
        messageId,
      );
      this.server
        .to(roomId)
        .emit('messageDeleted', { ...deletedMessage, roomId });
      return { success: true, data: deletedMessage };
    } catch (error) {
      this.logger.error('Delete message error:', error.stack);
      return {
        success: false,
        error: error.message || 'Failed to delete message',
      };
    }
  }

  @SubscribeMessage('closeChatRoom')
  async handleCloseChatRoom(
    @MessageBody() closeChatRoomDto: CloseChatRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id;
      const { roomId } = closeChatRoomDto;
      const closedRoom = await this.chatService.closeChatRoom(userId, roomId);
      this.server
        .to(roomId)
        .emit('chatRoomClosed', { roomId, closedBy: userId });
      this.server.in(roomId).socketsLeave(roomId);
      return { success: true, data: closedRoom };
    } catch (error) {
      this.logger.error('Close chat room error:', error.stack);
      return {
        success: false,
        error: error.message || 'Failed to close chat room',
      };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() typingDto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const user = client.data.user;
      if (!user) return; // Should not happen, but safe
      const { roomId, isTyping } = typingDto;
      client.to(roomId).emit('userTyping', {
        userId: user.id,
        senderInfo: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        },
        isTyping,
        roomId,
      });
      return { success: true };
    } catch (error) {
      this.logger.error('Typing error:', error.stack);
      return { success: false, error: 'Failed to process typing event' };
    }
  }

  // in src/chat/chat.gateway.ts

  // in src/chat/chat.gateway.ts

  @SubscribeMessage('getChatHistory')
  async handleGetChatHistory(
    @MessageBody() getChatHistoryDto: GetChatHistoryDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id;
      const { roomId } = getChatHistoryDto;

      const canAccess = await this.chatService.isUserInRoom(userId, roomId);
      if (!canAccess) {
        return {
          success: false,
          error: 'Access denied to this chat room',
        };
      }

      const chatHistory = await this.chatService.getChatHistory(roomId);

      // FIX: Convert complex Prisma objects into plain, serializable objects.
      // This removes circular references and other non-JSON properties.
      const serializableHistory = JSON.parse(JSON.stringify(chatHistory));

      // For better debugging, log the stringified version
      this.logger.log(
        `Returning ${serializableHistory.length} messages to client.`,
      );

      return {
        success: true,
        data: {
          messages: serializableHistory, // <-- Send the sanitized version
        },
      };
    } catch (error) {
      this.logger.error('Get chat history error:', error.stack);
      return {
        success: false,
        error: 'Failed to get chat history',
      };
    }
  }
}
