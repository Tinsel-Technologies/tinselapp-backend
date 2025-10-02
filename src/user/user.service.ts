import { PaginatedResourceResponse } from '@clerk/backend/dist/api/resources/Deserializer';
import { clerkClient, User } from '@clerk/express';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class UserService {
  private prisma = new PrismaClient();

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
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      return clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...currentMetadata,
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

      const currentMetadata = (user.publicMetadata as any) || {};
      const chatList = currentMetadata.chatList || [];

      if (chatList.includes(targetUserId)) {
        return { success: false, message: 'User already in chat list' };
      }

      const updatedChatList = [...chatList, targetUserId];
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...currentMetadata,
          chatList: updatedChatList,
        },
      });

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
      const currentMetadata = (user.publicMetadata as any) || {};
      const chatList = currentMetadata.chatList || [];

      if (!chatList.includes(targetUserId)) {
        return { success: false, message: 'User not in chat list' };
      }

      const updatedChatList = chatList.filter(
        (id: string) => id !== targetUserId,
      );

      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...currentMetadata,
          chatList: updatedChatList,
        },
      });

      return { success: true, message: 'User removed from chat list' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to remove user from chat list',
      );
    }
  }

  /**
   * Get user's chat list with user details
   */
  async getChatList(userId: string): Promise<User[]> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const chatList = currentMetadata.chatList || [];

      if (chatList.length === 0) {
        return [];
      }

      const chatUsers = await Promise.all(
        chatList.map(async (chatUserId: string) => {
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
      if (validChatUsers.length !== chatList.length) {
        const validUserIds = validChatUsers.map((user) => user.id);
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...currentMetadata,
            chatList: validUserIds,
          },
        });
      }

      return validChatUsers;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch chat list');
    }
  }

  async isInChatList(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const chatList = currentMetadata.chatList || [];
      return chatList.includes(targetUserId);
    } catch (error) {
      return false;
    }
  }

  async getChatListCount(userId: string): Promise<number> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const chatList = currentMetadata.chatList || [];
      return chatList.length;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch chat list count');
    }
  }

  async clearChatList(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const chatList = currentMetadata.chatList || [];

      if (chatList.length === 0) {
        return { success: false, message: 'Chat list is already empty' };
      }
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...currentMetadata,
          chatList: [],
        },
      });

      return { success: true, message: 'Chat list cleared successfully' };
    } catch (error) {
      throw new InternalServerErrorException('Failed to clear chat list');
    }
  }

  async suggestUsers(
    userId: string,
    limit: number = 9,
  ): Promise<{
    suggestions: User[];
    breakdown: { females: number; males: number };
  }> {
    try {
      const currentUser = await this.getUser(userId);
      const currentUserMetadata = (currentUser.publicMetadata as any) || {};
      const chatList = currentUserMetadata.chatList || [];

      const femalesNeeded = Math.ceil(limit / 3);
      const malesNeeded = limit - femalesNeeded;

      const allUsers = await clerkClient.users.getUserList({
        orderBy: '-last_active_at',
        limit: 500,
      });

      const availableUsers = allUsers.data.filter((user) => {
        if (user.id === userId || chatList.includes(user.id)) {
          return false;
        }

        const userMetadata = (user.publicMetadata as any) || {};
        return (
          userMetadata.gender === 'male' || userMetadata.gender === 'female'
        );
      });

      const femaleUsers = availableUsers.filter((user) => {
        const userMetadata = (user.publicMetadata as any) || {};
        return userMetadata.gender === 'female';
      });

      const maleUsers = availableUsers.filter((user) => {
        const userMetadata = (user.publicMetadata as any) || {};
        return userMetadata.gender === 'male';
      });

      const shuffledFemales = this.shuffleArray([...femaleUsers]);
      const shuffledMales = this.shuffleArray([...maleUsers]);

      const selectedFemales = shuffledFemales.slice(0, femalesNeeded);
      const selectedMales = shuffledMales.slice(0, malesNeeded);

      const suggestions = this.shuffleArray([
        ...selectedFemales,
        ...selectedMales,
      ]);

      return {
        suggestions,
        breakdown: {
          females: selectedFemales.length,
          males: selectedMales.length,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to generate user suggestions',
      );
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async getAllChatListUsers(userId: string): Promise<{
    chatList: User[];
    count: number;
    breakdown: { females: number; males: number; unknown: number };
  }> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const chatListIds = currentMetadata.chatList || [];

      if (chatListIds.length === 0) {
        return {
          chatList: [],
          count: 0,
          breakdown: { females: 0, males: 0, unknown: 0 },
        };
      }

      const chatUsers = await Promise.all(
        chatListIds.map(async (chatUserId: string) => {
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

      if (validChatUsers.length !== chatListIds.length) {
        const validUserIds = validChatUsers.map((user) => user.id);
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...currentMetadata,
            chatList: validUserIds,
          },
        });
      }

      const breakdown = validChatUsers.reduce(
        (acc, user) => {
          const userMetadata = (user.publicMetadata as any) || {};
          const gender = userMetadata.gender;

          if (gender === 'female') {
            acc.females++;
          } else if (gender === 'male') {
            acc.males++;
          } else {
            acc.unknown++;
          }

          return acc;
        },
        { females: 0, males: 0, unknown: 0 },
      );

      return {
        chatList: validChatUsers,
        count: validChatUsers.length,
        breakdown,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch chat list users');
    }
  }

  async getChatListUsersPaginated(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    chatList: User[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalUsers: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    breakdown: { females: number; males: number; unknown: number };
  }> {
    try {
      const allChatData = await this.getAllChatListUsers(userId);

      const totalUsers = allChatData.count;
      const totalPages = Math.ceil(totalUsers / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const paginatedUsers = allChatData.chatList.slice(startIndex, endIndex);

      return {
        chatList: paginatedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        breakdown: allChatData.breakdown,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch paginated chat list',
      );
    }
  }

  async addMultipleUsersToChatList(
    userId: string,
    targetUserIds: string[],
  ): Promise<{
    success: boolean;
    message: string;
    results: {
      added: string[];
      alreadyInList: string[];
      notFound: string[];
      errors: string[];
    };
    summary: {
      totalRequested: number;
      successfullyAdded: number;
      skipped: number;
      failed: number;
    };
  }> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const currentChatList = currentMetadata.chatList || [];

      const uniqueTargetIds = [...new Set(targetUserIds)].filter(
        (id) => id !== userId,
      );

      if (uniqueTargetIds.length === 0) {
        throw new BadRequestException('No valid user IDs provided');
      }

      const results = {
        added: [] as string[],
        alreadyInList: [] as string[],
        notFound: [] as string[],
        errors: [] as string[],
      };

      for (const targetUserId of uniqueTargetIds) {
        try {
          if (currentChatList.includes(targetUserId)) {
            results.alreadyInList.push(targetUserId);
            continue;
          }

          const targetUser = await this.getUser(targetUserId);
          if (!targetUser) {
            results.notFound.push(targetUserId);
            continue;
          }

          results.added.push(targetUserId);
        } catch (error) {
          if (error.message?.includes('not found') || error.status === 404) {
            results.notFound.push(targetUserId);
          } else {
            results.errors.push(targetUserId);
          }
        }
      }

      if (results.added.length > 0) {
        const updatedChatList = [...currentChatList, ...results.added];

        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...currentMetadata,
            chatList: updatedChatList,
          },
        });
      }

      const summary = {
        totalRequested: uniqueTargetIds.length,
        successfullyAdded: results.added.length,
        skipped: results.alreadyInList.length,
        failed: results.notFound.length + results.errors.length,
      };

      const success = results.added.length > 0;
      const message = success
        ? `Successfully added ${results.added.length} user(s) to chat list`
        : 'No users were added to chat list';

      return {
        success,
        message,
        results,
        summary,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to add multiple users to chat list',
      );
    }
  }

  async removeMultipleUsersFromChatList(
    userId: string,
    targetUserIds: string[],
  ): Promise<{
    success: boolean;
    message: string;
    results: {
      removed: string[];
      notInList: string[];
    };
    summary: {
      totalRequested: number;
      successfullyRemoved: number;
      notFound: number;
    };
  }> {
    try {
      const user = await this.getUser(userId);
      const currentMetadata = (user.publicMetadata as any) || {};
      const currentChatList = currentMetadata.chatList || [];

      const uniqueTargetIds = [...new Set(targetUserIds)];

      if (uniqueTargetIds.length === 0) {
        throw new BadRequestException('No valid user IDs provided');
      }

      const results = {
        removed: [] as string[],
        notInList: [] as string[],
      };

      uniqueTargetIds.forEach((targetUserId) => {
        if (currentChatList.includes(targetUserId)) {
          results.removed.push(targetUserId);
        } else {
          results.notInList.push(targetUserId);
        }
      });

      if (results.removed.length > 0) {
        const updatedChatList = currentChatList.filter(
          (id: string) => !results.removed.includes(id),
        );

        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...currentMetadata,
            chatList: updatedChatList,
          },
        });
      }

      const summary = {
        totalRequested: uniqueTargetIds.length,
        successfullyRemoved: results.removed.length,
        notFound: results.notInList.length,
      };

      const success = results.removed.length > 0;
      const message = success
        ? `Successfully removed ${results.removed.length} user(s) from chat list`
        : 'No users were removed from chat list';

      return {
        success,
        message,
        results,
        summary,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to remove multiple users from chat list',
      );
    }
  }

  async setOnlineStatus(
    userId: string,
    isOnline: boolean,
  ): Promise<{ success: boolean; message: string; status: any }> {
    try {
      await this.getUser(userId);

      const status = await this.prisma.userStatus.upsert({
        where: { userId },
        update: {
          isOnline,
          lastSeen: new Date(),
        },
        create: {
          userId,
          isOnline,
          lastSeen: new Date(),
        },
      });

      return {
        success: true,
        message: `User status updated to ${isOnline ? 'online' : 'offline'}`,
        status: {
          userId: status.userId,
          isOnline: status.isOnline,
          lastSeen: status.lastSeen,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to update online status');
    }
  }

  async getOnlineStatus(userId: string): Promise<{
    userId: string;
    isOnline: boolean;
    lastSeen: Date;
  }> {
    try {
      await this.getUser(userId);

      let status = await this.prisma.userStatus.findUnique({
        where: { userId },
      });

      if (!status) {
        status = await this.prisma.userStatus.create({
          data: {
            userId,
            isOnline: false,
            lastSeen: new Date(),
          },
        });
      }

      return {
        userId: status.userId,
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch online status');
    }
  }

  async getBulkOnlineStatus(userIds: string[]): Promise<{
    statuses: Array<{
      userId: string;
      isOnline: boolean;
      lastSeen: Date;
    }>;
    summary: {
      total: number;
      online: number;
      offline: number;
    };
  }> {
    try {
      const uniqueUserIds = [...new Set(userIds)];

      const statuses = await this.prisma.userStatus.findMany({
        where: {
          userId: {
            in: uniqueUserIds,
          },
        },
      });

      const statusMap = new Map(statuses.map((s) => [s.userId, s]));

      const results = uniqueUserIds.map((userId) => {
        const status = statusMap.get(userId);
        return {
          userId,
          isOnline: status?.isOnline ?? false,
          lastSeen: status?.lastSeen ?? new Date(),
        };
      });

      const onlineCount = results.filter((s) => s.isOnline).length;

      return {
        statuses: results,
        summary: {
          total: results.length,
          online: onlineCount,
          offline: results.length - onlineCount,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch bulk online status',
      );
    }
  }

  async getOnlineUsers(): Promise<{
    users: User[];
    count: number;
  }> {
    try {
      const onlineStatuses = await this.prisma.userStatus.findMany({
        where: {
          isOnline: true,
        },
      });

      const onlineUserIds = onlineStatuses.map((s) => s.userId);

      if (onlineUserIds.length === 0) {
        return { users: [], count: 0 };
      }

      const users = await Promise.all(
        onlineUserIds.map(async (userId) => {
          try {
            return await this.getUser(userId);
          } catch (error) {
            return null;
          }
        }),
      );

      const validUsers = users.filter((user) => user !== null) as User[];

      return {
        users: validUsers,
        count: validUsers.length,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch online users');
    }
  }

  async getChatListOnlineStatus(userId: string): Promise<{
    chatListUsers: Array<{
      user: User;
      isOnline: boolean;
      lastSeen: Date;
    }>;
    summary: {
      total: number;
      online: number;
      offline: number;
    };
  }> {
    try {
      const chatListUsers = await this.getChatList(userId);

      if (chatListUsers.length === 0) {
        return {
          chatListUsers: [],
          summary: { total: 0, online: 0, offline: 0 },
        };
      }

      const userIds = chatListUsers.map((user) => user.id);
      const bulkStatus = await this.getBulkOnlineStatus(userIds);

      const statusMap = new Map(bulkStatus.statuses.map((s) => [s.userId, s]));

      const chatListWithStatus = chatListUsers.map((user) => {
        const status = statusMap.get(user.id);
        return {
          user,
          isOnline: status?.isOnline ?? false,
          lastSeen: status?.lastSeen ?? new Date(),
        };
      });

      const onlineCount = chatListWithStatus.filter(
        (item) => item.isOnline,
      ).length;

      return {
        chatListUsers: chatListWithStatus,
        summary: {
          total: chatListWithStatus.length,
          online: onlineCount,
          offline: chatListWithStatus.length - onlineCount,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch chat list online status',
      );
    }
  }
}
