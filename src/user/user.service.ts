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
          gender: params.gender,
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

  async checkUsernameAvailability(username: string): Promise<{
    available: boolean;
    suggestions?: string[];
  }> {
    try {
      const existingUsers = await clerkClient.users.getUserList({
        username: [username],
      });

      const isAvailable = existingUsers.data.length === 0;

      if (isAvailable) {
        return { available: true };
      }
      const suggestions = await this.generateUsernameSuggestions(username);
      return {
        available: false,
        suggestions,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to check username availability',
      );
    }
  }

  private async generateUsernameSuggestions(
    baseUsername: string,
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const maxSuggestions = 5;

    try {
      for (let i = 1; i <= 3; i++) {
        const suggestion = `${baseUsername}${i}`;
        const isAvailable = await this.isUsernameAvailable(suggestion);
        if (isAvailable && suggestions.length < maxSuggestions) {
          suggestions.push(suggestion);
        }
      }

      for (let i = 0; i < 2 && suggestions.length < maxSuggestions; i++) {
        const randomNum = Math.floor(Math.random() * 9999) + 1;
        const suggestion = `${baseUsername}${randomNum}`;
        const isAvailable = await this.isUsernameAvailable(suggestion);
        if (isAvailable && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }

      if (suggestions.length < maxSuggestions) {
        const suggestion = `${baseUsername}_${Math.floor(Math.random() * 999) + 1}`;
        const isAvailable = await this.isUsernameAvailable(suggestion);
        if (isAvailable) {
          suggestions.push(suggestion);
        }
      }

      if (suggestions.length < maxSuggestions && baseUsername.length > 3) {
        const modifiedBase = baseUsername.slice(0, -1);
        const suggestion = `${modifiedBase}${Math.floor(Math.random() * 99) + 1}`;
        const isAvailable = await this.isUsernameAvailable(suggestion);
        if (isAvailable) {
          suggestions.push(suggestion);
        }
      }

      return suggestions;
    } catch (error) {
      return [
        `${baseUsername}1`,
        `${baseUsername}2`,
        `${baseUsername}${Math.floor(Math.random() * 999) + 1}`,
      ];
    }
  }

  private async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const existingUsers = await clerkClient.users.getUserList({
        username: [username],
      });
      return existingUsers.data.length === 0;
    } catch (error) {
      return false;
    }
  }
}
