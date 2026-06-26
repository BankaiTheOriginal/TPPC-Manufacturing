import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
export interface AuthUser {
  id: string;
  role: string;
}
export const CurrentUser = createParamDecorator(
  (data: string, context: ExecutionContext) => {
    const req: Request = context.switchToHttp().getRequest();

    return req.user as AuthUser;
  },
);
