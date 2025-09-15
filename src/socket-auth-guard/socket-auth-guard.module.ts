import { Module } from '@nestjs/common';
import { SocketAuthGuardService } from './socket-auth-guard.service';
import { SocketAuthGuardController } from './socket-auth-guard.controller';
import { ClerkClientProvider } from 'src/providers/clerk.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [SocketAuthGuardController],
  providers: [SocketAuthGuardService, ClerkClientProvider],
  exports: ['ClerkClient'],
})
export class SocketAuthGuardModule {}
