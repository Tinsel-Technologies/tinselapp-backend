import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ClerkClient, verifyToken } from '@clerk/backend';

@Injectable()
export class SocketAuthGuardService implements CanActivate {
  constructor(
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    
    if (client.data.user && client.data.tokenExpiry && client.data.tokenExpiry > Date.now()) {
      return true;
    }
    
    const token = this.extractTokenFromClient(client);

    if (!token) {
      throw new WsException('No authentication token provided');
    }

    try {
      const tokenPayload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      if (!tokenPayload) {
        throw new WsException('Invalid session');
      }

      const user = await this.clerkClient.users.getUser(tokenPayload.sub);
      client.data.user = user;
      client.data.tokenExpiry = (tokenPayload.exp * 1000) - 30000;
      
      return true;
    } catch (err) {
      console.error('Token verification error:', err);
      
      if (err.message?.includes('expired')) {
        client.emit('token_expired', 'Please refresh your authentication');
        return false; 
      }
      
      throw new WsException('Invalid or expired token');
    }
  }

  private extractTokenFromClient(client: Socket): string | null {
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    const authHeader = client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    if (client.handshake.query?.token) {
      return Array.isArray(client.handshake.query.token) 
        ? client.handshake.query.token[0] 
        : client.handshake.query.token;
    }

    if (client.handshake.headers?.cookie) {
      const cookies = this.parseCookies(client.handshake.headers.cookie);
      return cookies.__session || null;
    }

    return null;
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  }
}