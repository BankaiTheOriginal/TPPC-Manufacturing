import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditContextMiddleware } from './audit.context';
import { PrismaService } from 'src/prisma.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditContextMiddleware, PrismaService],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}

