import { Module } from '@nestjs/common';
import { MonetizationService } from './monetization.service';
import { MonetizationController } from './monetization.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClerkModule } from 'src/clerk/clerk.module';

@Module({
  imports:[PrismaModule, ClerkModule],
  controllers: [MonetizationController],
  providers: [MonetizationService],
})
export class MonetizationModule {}
