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
import { AuthGuardService } from '../auth-guard/auth-guard.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
  // transports: ['websocket'],
  // allowEIO3: true,
})
@UseGuards(AuthGuardService)
@UsePipes(new ValidationPipe())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      if (!userId) {
        client.disconnect();
        return;
      }

      this.chatService.registerUserSocket(userId, client.id);
      await client.join(`user_${userId}`);

      const activeChatRooms =
        await this.chatService.getUserActiveChatRooms(userId);
      for (const room of activeChatRooms) {
        await client.join(room.id);
      }

      for (const room of activeChatRooms) {
        const otherParticipant =
          room.participant1 === userId ? room.participant2 : room.participant1;

        if (this.chatService.isUserOnline(otherParticipant)) {
          this.server.to(`user_${otherParticipant}`).emit('userOnline', {
            userId,
            roomId: room.id,
            timestamp: new Date(),
          });
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
        timestamp: new Date(),
      });

      this.logger.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = this.chatService.unregisterUserSocket(client.id);

      if (userId) {
        const activeChatRooms =
          await this.chatService.getUserActiveChatRooms(userId);
        for (const room of activeChatRooms) {
          const otherParticipant =
            room.participant1 === userId
              ? room.participant2
              : room.participant1;

          this.server.to(`user_${otherParticipant}`).emit('userOffline', {
            userId,
            roomId: room.id,
            timestamp: new Date(),
          });
        }

        this.logger.log(`User ${userId} disconnected`);
      }
    } catch (error) {
      this.logger.error('Disconnection error:', error);
    }
  }

  @SubscribeMessage('createChatRoom')
  async handleCreateChatRoom(
    @MessageBody() createChatRoomDto: CreateChatRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.chatService.getUserIdFromSocket(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

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
        timestamp: new Date(),
      });

      this.logger.log(`Chat room ${room.id} created by user ${userId}`);
    } catch (error) {
      this.logger.error('Create chat room error:', error);
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        client.emit('error', { message: error.message });
      } else {
        client.emit('error', { message: 'Failed to create chat room' });
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() sendMessageDto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const senderId = this.chatService.getUserIdFromSocket(client.id);
      if (!senderId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const { roomId, message, messageType } = sendMessageDto;
      const chatMessage = await this.chatService.sendMessage(
        senderId,
        roomId,
        message,
        messageType,
      );

      // Emit to all users in the room
      this.server.to(roomId).emit('newMessage', {
        ...chatMessage,
        roomId,
      });

      this.logger.log(`Message sent by ${senderId} in room ${roomId}`);
    } catch (error) {
      this.logger.error('Send message error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        client.emit('error', { message: error.message });
      } else {
        client.emit('error', { message: 'Failed to send message' });
      }
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() editMessageDto: EditMessageDto & { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.chatService.getUserIdFromSocket(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const { roomId, messageId, newMessage } = editMessageDto;
      const editedMessage = await this.chatService.editMessage(
        userId,
        messageId,
        newMessage,
      );

      // Emit to all users in the room
      this.server.to(roomId).emit('messageEdited', {
        ...editedMessage,
        roomId,
      });

      this.logger.log(
        `Message ${messageId} edited by ${userId} in room ${roomId}`,
      );
    } catch (error) {
      this.logger.error('Edit message error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        client.emit('error', { message: error.message });
      } else {
        client.emit('error', { message: 'Failed to edit message' });
      }
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() deleteMessageDto: DeleteMessageDto & { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.chatService.getUserIdFromSocket(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const { roomId, messageId } = deleteMessageDto;
      const deletedMessage = await this.chatService.deleteMessage(
        userId,
        messageId,
      );

      // Emit to all users in the room
      this.server.to(roomId).emit('messageDeleted', {
        ...deletedMessage,
        roomId,
      });

      this.logger.log(
        `Message ${messageId} deleted by ${userId} in room ${roomId}`,
      );
    } catch (error) {
      this.logger.error('Delete message error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        client.emit('error', { message: error.message });
      } else {
        client.emit('error', { message: 'Failed to delete message' });
      }
    }
  }

  @SubscribeMessage('closeChatRoom')
  async handleCloseChatRoom(
    @MessageBody() closeChatRoomDto: CloseChatRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.chatService.getUserIdFromSocket(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const { roomId } = closeChatRoomDto;
      await this.chatService.closeChatRoom(userId, roomId);

      // Emit to all users in the room
      this.server.to(roomId).emit('chatRoomClosed', {
        roomId,
        closedBy: userId,
        timestamp: new Date(),
      });

      // Remove all users from the room
      this.server.in(roomId).socketsLeave(roomId);

      this.logger.log(`Chat room ${roomId} closed by user ${userId}`);
    } catch (error) {
      this.logger.error('Close chat room error:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        client.emit('error', { message: error.message });
      } else {
        client.emit('error', { message: 'Failed to close chat room' });
      }
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() typingDto: TypingDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.chatService.getUserIdFromSocket(client.id);
      if (!userId) return;

      const { roomId, isTyping } = typingDto;
      const room = await this.chatService.getChatRoom(roomId);

      if (
        !room ||
        (room.participant1 !== userId && room.participant2 !== userId)
      ) {
        return;
      }

      // Emit typing status to the room (excluding sender)
      client.to(roomId).emit('userTyping', {
        userId,
        senderInfo: room.participantsInfo?.[userId],
        isTyping,
        roomId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Typing error:', error);
    }
  }

  @SubscribeMessage('getChatHistory')
  async handleGetChatHistory(
    @MessageBody() getChatHistoryDto: GetChatHistoryDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.chatService.getUserIdFromSocket(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const { roomId, limit = 50, offset = 0 } = getChatHistoryDto;
      const room = await this.chatService.getChatRoom(roomId);

      if (
        !room ||
        (room.participant1 !== userId && room.participant2 !== userId)
      ) {
        client.emit('error', {
          message: 'Chat room not found or access denied',
        });
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
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Get chat history error:', error);
      client.emit('error', { message: 'Failed to get chat history' });
    }
  }
}
