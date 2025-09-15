import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { UserModule } from 'src/user/user.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClerkModule } from 'src/clerk/clerk.module';

@Module({
  imports: [PrismaModule, ClerkModule, UserModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
