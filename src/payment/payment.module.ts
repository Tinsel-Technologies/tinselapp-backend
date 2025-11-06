import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClerkModule } from 'src/clerk/clerk.module';
import { MpesaSecurityService } from './mpesa-security.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ClerkModule,ConfigModule],
  controllers: [PaymentController],
  providers: [PaymentService, MpesaSecurityService],
  exports: [PaymentService, MpesaSecurityService],
})
export class PaymentModule {}
