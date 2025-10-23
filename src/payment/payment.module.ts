import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClerkModule } from 'src/clerk/clerk.module';

@Module({
  imports: [PrismaModule, ClerkModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
