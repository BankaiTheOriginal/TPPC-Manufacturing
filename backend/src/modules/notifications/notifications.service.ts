import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    });
  }

  async createForMany(userIds: string[], data: {
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const metaStr = data.metadata ? JSON.stringify(data.metadata) : undefined;
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: metaStr,
      })),
    });
  }

  async getForUser(userId: string, opts?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const where: { userId: string; read?: boolean } = { userId };
    if (opts?.unreadOnly) where.read = false;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts?.limit ?? 50,
        skip: opts?.offset ?? 0,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
