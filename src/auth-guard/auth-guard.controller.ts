import { Controller } from '@nestjs/common';
import { AuthGuardService } from './auth-guard.service';

@Controller('authGuard')
export class AuthGuardController {
  constructor(private readonly authGuardService: AuthGuardService) {}
}
