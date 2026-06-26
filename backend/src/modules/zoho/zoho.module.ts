import { Module } from '@nestjs/common';
import { ZohoService } from './zoho.service';
import { ZohoController } from './zoho.controller';
import { ZohoSyncService } from './zoho-sync.service';
import { PrismaService } from 'src/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [CacheModule.register()],
  controllers: [ZohoController],
  providers: [ZohoService, PrismaService, ZohoSyncService],
  exports: [ZohoSyncService],
})
export class ZohoModule {}
