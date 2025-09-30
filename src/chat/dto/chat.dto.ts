import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class CreateChatRoomDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  message: string;

  @IsOptional()
  @IsEnum(MessageType)
  fileUrl: string;

  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType = MessageType.TEXT;

  @IsString()
  @IsOptional()
  repliedToId?: string;
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  newMessage: string;
}

export class DeleteMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class CloseChatRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class TypingDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsBoolean()
  @IsNotEmpty()
  isTyping: boolean;
}

export class GetChatHistoryDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}


export class GetUserOnlineStatusDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

export class MarkMessageAsReadDto {
  messageId: string;
  roomId: string;
}

export class GetMessageReadReceiptsDto {
  messageId: string;
  roomId: string;
}