import { Module } from '@nestjs/common';
import { ChatlistService } from './chatlist.service';
import { ChatlistController } from './chatlist.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClerkModule } from 'src/clerk/clerk.module';
import { UserService } from 'src/user/user.service';

@Module({
  imports:[PrismaModule, ClerkModule],
  controllers: [ChatlistController],
  providers: [ChatlistService,UserService],
  exports: [ChatlistService],
})
export class ChatlistModule {}
