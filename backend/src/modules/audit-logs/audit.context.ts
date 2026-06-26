import {
  ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'crypto';

/**
 * Per-request audit context that gets attached to req.auditContext by the
 * AuditContextMiddleware. Service-layer audit calls pull from this so they
 * don't have to thread Request through every signature.
 */
export interface AuditRequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  httpMethod?: string;
  route?: string;
  sessionId?: string;
  actorId?: string;
  impersonatedById?: string;
}

const HEADER_REQUEST_ID = 'x-request-id';
const HEADER_FORWARDED_FOR = 'x-forwarded-for';
const HEADER_REAL_IP = 'x-real-ip';

function pickHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

function pickIp(req: Request): string | undefined {
  const xff = pickHeader(req, HEADER_FORWARDED_FOR);
  if (xff) return xff.split(',')[0]!.trim();
  const real = pickHeader(req, HEADER_REAL_IP);
  if (real) return real.trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

@Injectable()
export class AuditContextMiddleware {
  use(req: Request, _res: unknown, next: () => void): void {
    const reqId = pickHeader(req, HEADER_REQUEST_ID) ?? randomUUID();
    const ctx: AuditRequestContext = {
      requestId: reqId,
      ipAddress: pickIp(req),
      userAgent: pickHeader(req, 'user-agent'),
      httpMethod: req.method,
      route: req.originalUrl ?? req.url,
    };
    (req as Request & { auditContext: AuditRequestContext }).auditContext = ctx;
    next();
  }
}

/**
 * Param decorator for controllers that want the current request's audit
 * context injected directly: `loginHandler(@AuditCtx() ctx: AuditRequestContext)`.
 */
export const AuditCtx = createParamDecorator(
  (_: unknown, exec: ExecutionContext): AuditRequestContext => {
    const req = exec
      .switchToHttp()
      .getRequest<Request & { auditContext?: AuditRequestContext }>();
    return (
      req.auditContext ?? {
        requestId: randomUUID(),
        httpMethod: req?.method,
        route: req?.url,
      }
    );
  },
);
