import { Module } from '@nestjs/common';
import { FactoryActivityService } from './factory-activity.service';
import { FactoryActivityController } from './factory-activity.controller';
import { PrismaService } from 'src/prisma.service';
import { ProductionOrdersModule } from '../production-orders/production-orders.module';

@Module({
  imports: [ProductionOrdersModule],
  controllers: [FactoryActivityController],
  providers: [FactoryActivityService, PrismaService],
})
export class FactoryActivityModule {}
