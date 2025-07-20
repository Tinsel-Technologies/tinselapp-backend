import { PaginatedResourceResponse } from '@clerk/backend/dist/api/resources/Deserializer';
import { clerkClient, User } from '@clerk/express';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class UserService {
  async getUsers(): Promise<PaginatedResourceResponse<User[]>> {
    try {
      return await clerkClient.users.getUserList({
        orderBy: '-last_active_at',
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async getUser(userId: string): Promise<User> {
    try {
      return await clerkClient.users.getUser(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async editUsername(userId: string, username: string): Promise<User> {
    try {
      return await clerkClient.users.updateUser(userId, {
        username: username,
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async updateUserPassword(userId: string, password: string): Promise<User> {
    try {
      return await clerkClient.users.updateUser(userId, {
        password: password,
        skipPasswordChecks: false,
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async verifyPassword(
    userId: string,
    password: string,
  ): Promise<{ verified: true }> {
    try {
      return await clerkClient.users.verifyPassword({ userId, password });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async updateUserMetadata(
    userId: string,
    params: UpdateUserMetadataParams,
  ): Promise<User> {
    try {
      return clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          location: params.location,
          dateOfBirth: params.dateOfBirth,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to update user metadata');
    }
  }

  async searchUsersByLocation(
    searchParams: SearchUsersParams,
  ): Promise<PaginatedResourceResponse<User[]>> {
    try {
      const { location, orderBy = '-last_active_at' } = searchParams;
      return await clerkClient.users.getUserList({
        query: location,
        orderBy,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to search users by location',
      );
    }
  }
}
