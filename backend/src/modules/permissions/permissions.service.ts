import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { USER_PUBLIC_SELECT } from '../user/user.constants';
import {
  getPermissionKeysForRole,
  getRoleDescription,
  getRoleLabel,
  PERMISSION_MODULES,
  ROLE_PERMISSION_KEYS,
} from './permissions.constants';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  getRoleMatrix() {
    return Object.entries(ROLE_PERMISSION_KEYS).map(([role, moduleKeys]) => ({
      role,
      label: getRoleLabel(role),
      description: getRoleDescription(role),
      permissions: moduleKeys.map((key) => PERMISSION_MODULES[key]),
    }));
  }

  async getUsersWithPermissions() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: USER_PUBLIC_SELECT,
    });

    return users.map((user) => ({
      ...user,
      roleLabel: getRoleLabel(user.role),
      permissions: getPermissionKeysForRole(user.role).map(
        (key) => PERMISSION_MODULES[key],
      ),
    }));
  }
}
