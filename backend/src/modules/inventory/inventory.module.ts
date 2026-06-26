import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaService } from 'src/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ZohoModule } from '../zoho/zoho.module';
import { ZohoService } from '../zoho/zoho.service';

@Module({
  imports: [CacheModule.register(), ZohoModule],
  controllers: [InventoryController],
  providers: [InventoryService, PrismaService, ZohoService],
})
export class InventoryModule {}
