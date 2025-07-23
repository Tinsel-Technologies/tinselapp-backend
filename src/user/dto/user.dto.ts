import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
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
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  targetUsername: string;
}

export class RemoveFromChatListDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  targetUsername: string;
}

export class CheckChatListDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  targetUsername: string;
}