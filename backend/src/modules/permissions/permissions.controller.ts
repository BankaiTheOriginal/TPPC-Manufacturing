import { Controller, Get } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('roles')
  getRoleMatrix() {
    return this.permissionsService.getRoleMatrix();
  }

  @Get('users')
  getUsersWithPermissions() {
    return this.permissionsService.getUsersWithPermissions();
  }
}