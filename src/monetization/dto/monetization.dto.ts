import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  IsArray,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '@prisma/client';

export class ChatTimeTierDto {
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetMonetizationSettingsDto {
  @IsBoolean()
  isEnabled: boolean;

  @ValidateIf((o) => o.isEnabled === true)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatTimeTierDto)
  chatTimeTiers: ChatTimeTierDto[];

  @IsOptional()
  @IsBoolean()
  monetizeVoiceNotes?: boolean;

  @ValidateIf((o) => o.monetizeVoiceNotes === true)
  @IsNumber()
  @Min(0.01)
  voiceNotePrice?: number;

  @IsOptional()
  @IsBoolean()
  monetizeImages?: boolean;

  @ValidateIf((o) => o.monetizeImages === true)
  @IsNumber()
  @Min(0.01)
  imagePrice?: number;

  @IsOptional()
  @IsBoolean()
  monetizeVideos?: boolean;

  @ValidateIf((o) => o.monetizeVideos === true)
  @IsNumber()
  @Min(0.01)
  videoPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateMonetizationSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatTimeTierDto)
  chatTimeTiers?: ChatTimeTierDto[];

  @IsOptional()
  @IsBoolean()
  monetizeVoiceNotes?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  voiceNotePrice?: number;

  @IsOptional()
  @IsBoolean()
  monetizeImages?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  imagePrice?: number;

  @IsOptional()
  @IsBoolean()
  monetizeVideos?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  videoPrice?: number;
}

export class PurchaseChatTimeDto {
  @IsString()
  sellerId: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;
}

export class CalculateContentCostDto {
  @IsString()
  recipientId: string;

  @IsString()
  contentType: MessageType;

  @ValidateIf(
    (o) =>
      o.contentType === MessageType.AUDIO ||
      o.contentType === MessageType.VIDEO,
  )
  @IsNumber()
  @Min(1)
  durationSeconds?: number;
}

export interface MonetizationInfo {
  isMonetized: boolean;
  settings?: {
    chatTimeTiers: Array<{
      durationMinutes: number;
      price: number;
      isActive: boolean;
    }>;
    voiceNotePrice?: number;
    imagePrice?: number;
    videoPrice?: number;
    monetizeVoiceNotes: boolean;
    monetizeImages: boolean;
    monetizeVideos: boolean;
    currency: string;
  };
}

export interface ChatSessionInfo {
  id: string;
  buyerId: string;
  sellerId: string;
  durationMinutes: number;
  price: number;
  currency: string;
  startTime: Date;
  endTime: Date;
  remainingMinutes: number;
  usedMinutes: number;
  isPaused: boolean;
  isActive: boolean;
  isPaid: boolean;
}

export interface ContentCostCalculation {
  sessionRequired: boolean;
  sessionCost?: {
    availableTiers: Array<{
      durationMinutes: number;
      price: number;
    }>;
  };
  additionalCost?: {
    contentType: MessageType;
    basePrice: number;
    units: number;
    totalCost: number;
    currency: string;
    description: string;
  };
}
