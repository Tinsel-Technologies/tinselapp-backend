import { Module } from '@nestjs/common';
import { ClerkClientProvider } from './providers/clerk.provider';
import { AuthGuardModule } from './auth-guard/auth-guard.module';
import { UserModule } from './user/user.module';
import { AuthGuardService } from './auth-guard/auth-guard.service';
import { UserService } from './user/user.service';
import { UserController } from './user/user.controller';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { ClerkModule } from './clerk/clerk.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthGuardModule,
    PrismaModule,
    ChatModule,
    PrismaModule,
    ChatModule,
    ClerkModule,
  ],
  controllers: [UserController, AppController],
  providers: [
    AuthGuardService,
    UserService,
    ClerkClientProvider,
    AppService,
    PrismaService,
  ],
})
export class AppModule {}
