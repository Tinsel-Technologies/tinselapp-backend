import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { UserModule } from 'src/user/user.module';
import { AuthGuardModule } from 'src/auth-guard/auth-guard.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [UserModule, AuthGuardModule, PrismaModule],
  providers: [ChatGateway, ChatService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
