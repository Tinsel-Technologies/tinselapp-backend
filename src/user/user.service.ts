import { PaginatedResourceResponse } from '@clerk/backend/dist/api/resources/Deserializer';
import { clerkClient, User } from '@clerk/express';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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

  async suggestUsername(userId: string): Promise<{ suggestions: string[] }> {
    try {
      const user = await this.getUser(userId);

      if (!user.firstName || !user.lastName) {
        throw new BadRequestException(
          'User must have both first name and last name to generate suggestions',
        );
      }

      const firstName = user.firstName.toLowerCase().trim();
      const lastName = user.lastName.toLowerCase().trim();

      const suggestions = await this.generateUsernameFromName(
        firstName,
        lastName,
      );

      return { suggestions };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to generate username suggestions',
      );
    }
  }

  private async generateUsernameFromName(
    firstName: string,
    lastName: string,
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const maxSuggestions = 8;

    try {
      const basePatterns = [
        `${firstName}${lastName}`,
        `${firstName}_${lastName}`,
        `${firstName}.${lastName}`,
        `${firstName}${lastName.charAt(0)}`,
        `${firstName.charAt(0)}${lastName}`,
      ];

      for (const base of basePatterns) {
        if (suggestions.length >= maxSuggestions) break;
        const isAvailable = await this.isUsernameAvailable(base);
        if (isAvailable) {
          suggestions.push(base);
        }
      }

      for (const base of basePatterns) {
        if (suggestions.length >= maxSuggestions) break;
        for (let i = 1; i <= 99 && suggestions.length < maxSuggestions; i++) {
          const suggestion = `${base}${i}`;
          const isAvailable = await this.isUsernameAvailable(suggestion);
          if (isAvailable) {
            suggestions.push(suggestion);
          }
        }
      }

      for (const base of basePatterns.slice(0, 2)) {
        if (suggestions.length >= maxSuggestions) break;

        for (let i = 1; i <= 50 && suggestions.length < maxSuggestions; i++) {
          const suggestion = `${base}_${i}`;
          const isAvailable = await this.isUsernameAvailable(suggestion);
          if (isAvailable) {
            suggestions.push(suggestion);
          }
        }
      }

      if (suggestions.length < maxSuggestions) {
        const primaryBase = `${firstName}${lastName}`;
        for (let i = 0; i < 20 && suggestions.length < maxSuggestions; i++) {
          const randomNum = Math.floor(Math.random() * 9999) + 100;
          const patterns = [
            `${primaryBase}${randomNum}`,
            `${firstName}_${lastName}_${randomNum}`,
            `${firstName}${randomNum}`,
          ];

          for (const pattern of patterns) {
            if (suggestions.length >= maxSuggestions) break;

            const isAvailable = await this.isUsernameAvailable(pattern);
            if (isAvailable && !suggestions.includes(pattern)) {
              suggestions.push(pattern);
            }
          }
        }
      }

      return suggestions.slice(0, maxSuggestions);
    } catch (error) {
      const fallback = [
        `${firstName}${lastName}1`,
        `${firstName}_${lastName}`,
        `${firstName}${lastName}${Math.floor(Math.random() * 999) + 1}`,
        `${firstName}_${lastName}_1`,
      ];
      return fallback;
    }
  }

  async addToChatList(
    userId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const [user, targetUser] = await Promise.all([
        this.getUser(userId),
        this.getUser(targetUserId),
      ]);

      if (!user || !targetUser) {
        throw new NotFoundException('One or both users not found');
      }

      if (userId === targetUserId) {
        throw new BadRequestException('Cannot add yourself to chat list');
      }
      const chatListData = this.getChatListData(user);
      if (chatListData.chatList.includes(targetUserId)) {
        return { success: false, message: 'User already in chat list' };
      }
      chatListData.chatList.push(targetUserId);
      await this.updateChatListData(userId, chatListData);
      return { success: true, message: 'User added to chat list' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add user to chat list');
    }
  }

  async removeFromChatList(
    userId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.getUser(userId);
      const chatListData = this.getChatListData(user);
      if (!chatListData.chatList.includes(targetUserId)) {
        return { success: false, message: 'User not in chat list' };
      }
      chatListData.chatList = chatListData.chatList.filter(
        (id) => id !== targetUserId,
      );
      await this.updateChatListData(userId, chatListData);
      return { success: true, message: 'User removed from chat list' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to remove user from chat list',
      );
    }
  }

  async getChatList(userId: string): Promise<User[]> {
    try {
      const user = await this.getUser(userId);
      const chatListData = this.getChatListData(user);

      if (chatListData.chatList.length === 0) {
        return [];
      }

      const chatUsers = await Promise.all(
        chatListData.chatList.map(async (chatUserId) => {
          try {
            return await this.getUser(chatUserId);
          } catch (error) {
            return null;
          }
        }),
      );
      const validChatUsers = chatUsers.filter(
        (user) => user !== null,
      ) as User[];
      if (validChatUsers.length !== chatListData.chatList.length) {
        chatListData.chatList = validChatUsers.map((user) => user.id);
        await this.updateChatListData(userId, chatListData);
      }

      return validChatUsers;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch chat list');
    }
  }

  async isInChatList(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      const chatListData = this.getChatListData(user);
      return chatListData.chatList.includes(targetUserId);
    } catch (error) {
      return false;
    }
  }

  async getChatListCount(userId: string): Promise<number> {
    try {
      const user = await this.getUser(userId);
      const chatListData = this.getChatListData(user);
      return chatListData.chatList.length;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch chat list count');
    }
  }

  async clearChatList(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.getUser(userId);
      const chatListData = this.getChatListData(user);

      if (chatListData.chatList.length === 0) {
        return { success: false, message: 'Chat list is already empty' };
      }

      chatListData.chatList = [];
      await this.updateChatListData(userId, chatListData);

      return { success: true, message: 'Chat list cleared successfully' };
    } catch (error) {
      throw new InternalServerErrorException('Failed to clear chat list');
    }
  }

  private getChatListData(user: User): ChatListData {
    const metadata = (user.publicMetadata as any) || {};
    return {
      chatList: metadata.chatList || [],
    };
  }

  private async updateChatListData(
    userId: string,
    chatListData: ChatListData,
  ): Promise<void> {
    const user = await this.getUser(userId);
    const existingMetadata = (user.publicMetadata as any) || {};

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existingMetadata,
        chatList: chatListData.chatList,
      },
    });
  }
}
