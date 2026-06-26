import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from 'generated/prisma/enums';
import { Observable } from 'rxjs';
import type { User } from 'generated/prisma/browser';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuards implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;
    const req = context.switchToHttp().getRequest<Request & { user?: User }>();
    const user = req.user;
    if (!user || !user.role) return false;

    return requiredRoles.includes(user.role);
  }
}
