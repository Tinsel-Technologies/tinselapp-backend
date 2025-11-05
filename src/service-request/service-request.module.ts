import { Module } from '@nestjs/common';
import { ServiceRequestService } from './service-request.service';
import { ServiceRequestController } from './service-request.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClerkModule } from 'src/clerk/clerk.module';

@Module({
  imports: [PrismaModule, ClerkModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService],
})
export class ServiceRequestModule {}
