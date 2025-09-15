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
import {
  UseGuards,
  UsePipes,
  ValidationPipe,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
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
import { SocketAuthGuardService } from 'src/socket-auth-guard/socket-auth-guard.service';
import { ClerkClient, User , verifyToken} from '@clerk/backend'; // Use the correct type from Clerk

// This is a custom type to make the 'user' property on the socket type-safe
interface AuthenticatedSocket extends Socket {
  data: {
    user: User;
  };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
// You can keep this guard for all @SubscribeMessage handlers
@UseGuards(SocketAuthGuardService)
@UsePipes(new ValidationPipe())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Inject ClerkClient directly to handle connection auth
  constructor(
    private readonly chatService: ChatService,
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
  ) {}

  // THIS IS THE MAIN FIX
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Step 1: Extract the token from the handshake
      const token = this.extractTokenFromClient(client);
      if (!token) {
        throw new Error('No authentication token provided');
      }

      // Step 2: Verify the token
      const tokenPayload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

 
      const user = await this.clerkClient.users.getUser(tokenPayload.sub);
      client.data.user = user;
      const userId = user.id;

      // Step 4: Proceed with your original connection logic
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

      this.logger.log(`User ${userId} (${user.firstName}) connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}: ${error.message}`);
      client.emit('auth_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    // This logic remains the same
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

  // Helper method to keep code DRY (copy from your guard)
  private extractTokenFromClient(client: Socket): string | null {
    const authHeader =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader; // Also handle case where it's just the token
  }

  @SubscribeMessage('createChatRoom')
  async handleCreateChatRoom(
    @MessageBody() createChatRoomDto: CreateChatRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      // CORRECTED: Get user directly from the socket
      const user = client.data.user;
      const userId = user.id;

      const { recipientId } = createChatRoomDto;
      const room = await this.chatService.createChatRoom(userId, recipientId);

      // Make both users join the socket.io room
      await client.join(room.id);
      const recipientSocketId =
        this.chatService.getSocketIdFromUser(recipientId);
      if (recipientSocketId) {
        this.server.sockets.sockets.get(recipientSocketId)?.join(room.id);
      }

      const otherParticipantId =
        room.participant1 === userId ? room.participant2 : room.participant1;

      // Emit the created room to BOTH users
      this.server.to(room.id).emit('chatRoomCreated', {
        room: {
          ...room,
          otherParticipant: room.participantsInfo?.[otherParticipantId],
        },
        createdBy: userId,
      });

      this.logger.log(`Chat room ${room.id} created by user ${userId}`);
    } catch (error) {
      this.logger.error('Create chat room error:', error);
      client.emit('error', {
        message: error.message || 'Failed to create chat room',
      });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() sendMessageDto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      // CORRECTED: Get user directly from the socket
      const user = client.data.user;
      const senderId = user.id;

      const { roomId, message, messageType } = sendMessageDto;
      const chatMessage = await this.chatService.sendMessage(
        senderId,
        roomId,
        message,
        messageType,
      );

      this.server.to(roomId).emit('newMessage', {
        ...chatMessage,
        roomId, // Include roomId in the payload for client-side logic
      });

      this.logger.log(`Message sent by ${senderId} in room ${roomId}`);
    } catch (error) {
      this.logger.error('Send message error:', error);
      client.emit('error', {
        message: error.message || 'Failed to send message',
      });
    }
  }

  // Apply the same correction for all other message handlers...

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() editMessageDto: EditMessageDto & { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id; // CORRECTED
      const { roomId, messageId, newMessage } = editMessageDto;
      const editedMessage = await this.chatService.editMessage(
        userId,
        messageId,
        newMessage,
      );
      this.server
        .to(roomId)
        .emit('messageEdited', { ...editedMessage, roomId });
    } catch (error) {
      this.logger.error('Edit message error:', error);
      client.emit('error', {
        message: error.message || 'Failed to edit message',
      });
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() deleteMessageDto: DeleteMessageDto & { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id; // CORRECTED
      const { roomId, messageId } = deleteMessageDto;
      const deletedMessage = await this.chatService.deleteMessage(
        userId,
        messageId,
      );
      this.server
        .to(roomId)
        .emit('messageDeleted', { ...deletedMessage, roomId });
    } catch (error) {
      this.logger.error('Delete message error:', error);
      client.emit('error', {
        message: error.message || 'Failed to delete message',
      });
    }
  }

  @SubscribeMessage('closeChatRoom')
  async handleCloseChatRoom(
    @MessageBody() closeChatRoomDto: CloseChatRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id; // CORRECTED
      const { roomId } = closeChatRoomDto;
      await this.chatService.closeChatRoom(userId, roomId);
      this.server
        .to(roomId)
        .emit('chatRoomClosed', { roomId, closedBy: userId });
      this.server.in(roomId).socketsLeave(roomId);
    } catch (error) {
      this.logger.error('Close chat room error:', error);
      client.emit('error', {
        message: error.message || 'Failed to close chat room',
      });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() typingDto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const user = client.data.user; // CORRECTED
      if (!user) return;

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
    } catch (error) {
      this.logger.error('Typing error:', error);
    }
  }

  @SubscribeMessage('getChatHistory')
  async handleGetChatHistory(
    @MessageBody() getChatHistoryDto: GetChatHistoryDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const userId = client.data.user.id; // CORRECTED
      const { roomId, limit = 50, offset = 0 } = getChatHistoryDto;

      const canAccess = await this.chatService.isUserInRoom(userId, roomId);
      if (!canAccess) {
        client.emit('error', { message: 'Access denied to this chat room' });
        return;
      }

      const chatHistory = await this.chatService.getChatHistory(
        roomId,
        limit,
        offset,
      );

      client.emit('chatHistory', {
        roomId,
        messages: chatHistory,
        hasMore: chatHistory.length === limit,
      });
    } catch (error) {
      this.logger.error('Get chat history error:', error);
      client.emit('error', { message: 'Failed to get chat history' });
    }
  }
}
