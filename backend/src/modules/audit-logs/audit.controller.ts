import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtGuard)
@Roles('ADMINISTRATOR' as any, 'GENERAL_MANAGER' as any)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.auditService.findAll({
      page: Number(page),
      limit: Number(limit),
      entityType,
      action,
      userId,
      eventCategory,
      status,
      severity,
    });
  }

  // Administrators-only chain integrity check. Walks up to `limit` rows and
  // reports the first hash/prevHash break, if any.
  @Roles('ADMINISTRATOR' as any)
  @Get('verify')
  async verify(@Query('limit') limit = '5000') {
    return this.auditService.verifyChain({ limit: Number(limit) });
  }
}

