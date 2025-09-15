import { Module } from '@nestjs/common';
import { SocketAuthGuardService } from './socket-auth-guard.service';
import { SocketAuthGuardController } from './socket-auth-guard.controller';
import { ClerkClientProvider } from 'src/providers/clerk.provider';
import { ConfigModule } from '@nestjs/config';
import { ClerkModule } from 'src/clerk/clerk.module';

@Module({
  imports: [ConfigModule, ClerkModule],
  controllers: [SocketAuthGuardController],
  providers: [SocketAuthGuardService],
  exports: [SocketAuthGuardService],
})
export class SocketAuthGuardModule {}
