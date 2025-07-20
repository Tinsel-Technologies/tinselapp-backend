import { Module } from '@nestjs/common';
import { AuthGuardService } from './auth-guard.service';
import { ClerkClientProvider } from 'src/providers/clerk.provider';
import { ConfigModule } from '@nestjs/config';
import { AuthGuardController } from './auth-guard.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AuthGuardController],
  providers: [AuthGuardService, ClerkClientProvider],
  exports: ['ClerkClient'],
})
export class AuthGuardModule {}
