import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MachineryController } from './machinery.controller';
import { MachineryService } from './machinery.service';

@Module({
  controllers: [MachineryController],
  providers: [MachineryService, PrismaService],
})
export class MachineryModule {}