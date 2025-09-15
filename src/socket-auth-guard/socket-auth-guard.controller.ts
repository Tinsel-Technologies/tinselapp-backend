import { Controller } from '@nestjs/common';
import { SocketAuthGuardService } from './socket-auth-guard.service';

@Controller('socket-auth-guard')
export class SocketAuthGuardController {
  constructor(private readonly socketAuthGuardService: SocketAuthGuardService) {}
}
