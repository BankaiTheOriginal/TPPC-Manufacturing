import { Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() req: { user: { sub: string } },
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getForUser(req.user.sub, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: { user: { sub: string } }) {
    const count = await this.notificationsService.getUnreadCount(req.user.sub);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.notificationsService.markAsRead(id, req.user.sub);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: { user: { sub: string } }) {
    await this.notificationsService.markAllAsRead(req.user.sub);
    return { success: true };
  }
}
