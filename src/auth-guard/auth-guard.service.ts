import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ClerkClient, verifyToken } from '@clerk/backend';

@Injectable()
export class AuthGuardService implements CanActivate {

    private readonly logger = new Logger(AuthGuardService.name);
  constructor(
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.cookies.__session;
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (bearerToken) {
      console.log('Bearer Token for Postman:', bearerToken);
      this.logger.log('Bearer Token for Postman:', bearerToken);
    }

    if (!sessionToken && !bearerToken) {
      throw new UnauthorizedException('No authentication token provided');
    }
    try {
      const tokenToVerify = bearerToken || sessionToken;
      const tokenPayload = await verifyToken(tokenToVerify, {
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: 60000,
      });

      if (!tokenPayload) {
        throw new UnauthorizedException('Invalid session');
      }
      const user = await this.clerkClient.users.getUser(tokenPayload.sub);
      (request as any).user = user;
      return true;
    } catch (err) {
      console.error('Token verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}