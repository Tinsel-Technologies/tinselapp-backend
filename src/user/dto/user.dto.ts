import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  username: string;
}

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class VerifyPasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CheckUsernameDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim().toLowerCase())
  username: string;
}

export class UserParamsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AddToChatListDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class RemoveFromChatListDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class CheckChatListDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class SuggestUsersDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(3)
  @Max(30)
  limit?: number = 9;
}

export class GetChatListDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class BulkAddToChatListDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  targetUserIds: string[];
}

export class BulkRemoveFromChatListDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  targetUserIds: string[];
}
