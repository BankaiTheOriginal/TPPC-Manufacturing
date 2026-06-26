import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

@Module({
  controllers: [VendorController],
  providers: [VendorService, PrismaService],
})
export class VendorModule {}