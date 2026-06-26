import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './common/guards/jwt.guard';
import { RolesGuards } from './common/guards/roles.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './common/configuration';
import authConfiguration from './common/auth-configuration';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ProductionOrdersModule } from './modules/production-orders/production-orders.module';
import { ZohoModule } from './modules/zoho/zoho.module';
import { AuditModule } from './modules/audit-logs/audit.module';
import { LocationModule } from './modules/location/location.module';
import { FactoryActivityModule } from './modules/factory-activity/factory-activity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { MachineryModule } from './modules/machinery/machinery.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, authConfiguration],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    CacheModule.register(),
    AuthModule,
    UserModule,
    InventoryModule,
    ProductionOrdersModule,
    ZohoModule,
    AuditModule,
    LocationModule,
    MachineryModule,
    VendorModule,
    FactoryActivityModule,
    NotificationsModule,
    PermissionsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuards },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
