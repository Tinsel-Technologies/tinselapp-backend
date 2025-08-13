import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkClientProvider } from 'src/providers/clerk.provider';

@Module({
  imports: [ConfigModule],
  providers: [ClerkClientProvider],
  exports: ['ClerkClient'],
})
export class ClerkModule {}
