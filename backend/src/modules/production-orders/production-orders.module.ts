import { Module } from '@nestjs/common';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionOrdersController } from './production-orders.controller';
import { PrismaService } from 'src/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { AuditService } from '../audit-logs/audit.service';
import { ZohoModule } from '../zoho/zoho.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CacheModule.register(), ZohoModule, NotificationsModule],
  controllers: [ProductionOrdersController],
  providers: [ProductionOrdersService, PrismaService, AuditService],
  exports: [ProductionOrdersService],
})
export class ProductionOrdersModule {}
