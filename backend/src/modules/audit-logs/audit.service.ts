import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import type { AuditRequestContext } from './audit.context';

export type AuditEventCategory = 'AUTH' | 'RBAC' | 'DATA' | 'SYSTEM';
export type AuditStatus = 'SUCCESS' | 'FAILURE';
export type AuditSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type AuditActorType = 'USER' | 'SYSTEM' | 'API_KEY';

export type AuditAuthAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_ROTATE'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'MFA_ENROLL'
  | 'MFA_DISABLE'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED';

export type AuditDataAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ_SENSITIVE'
  | 'EXPORT';

export type AuditRbacAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'ROLE_CHANGED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED';

export type AuditSystemAction =
  | 'CONFIG_CHANGED'
  | 'FEATURE_FLAG_TOGGLED'
  | 'INTEGRATION_CONNECTED'
  | 'INTEGRATION_DISCONNECTED'
  | 'SECRET_ROTATED';

type AnyAuditAction =
  | AuditAuthAction
  | AuditDataAction
  | AuditRbacAction
  | AuditSystemAction
  | string;

export interface AuditLogPayload {
  eventCategory: AuditEventCategory;
  action: AnyAuditAction;
  entityType: string;
  entityId: string;
  userId?: string | null;
  actorEmail?: string | null;
  actorType?: AuditActorType;
  impersonatedById?: string | null;
  status?: AuditStatus;
  severity?: AuditSeverity;
  changes?: { before?: unknown; after?: unknown } | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ctx?: AuditRequestContext;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'refreshtoken',
  'accesstoken',
  'token',
  'apikey',
  'api_key',
  'clientsecret',
  'client_secret',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'sessiontoken',
  'sessionkey',
]);

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForAudit(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeForAudit(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            canonicalJson((value as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Append-only insert. Selects the latest row's hash inside the same
  // transaction so the chain is continuous under concurrent writes. Errors
  // are logged but never thrown — losing an audit gap is preferable to
  // breaking the caller.
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const last = await tx.auditLog.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { hash: true },
        });
        const prevHash = last?.hash ?? 'genesis';

        const cleanChanges = payload.changes
          ? (sanitizeForAudit(payload.changes) as Record<string, unknown>)
          : null;
        const cleanMetadata = payload.metadata
          ? (sanitizeForAudit(payload.metadata) as Record<string, unknown>)
          : null;

        const corePayload = {
          eventCategory: payload.eventCategory,
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId,
          userId: payload.userId ?? null,
          actorEmail: payload.actorEmail ?? null,
          actorType: payload.actorType ?? 'USER',
          impersonatedById: payload.impersonatedById ?? null,
          status: payload.status ?? 'SUCCESS',
          severity: payload.severity ?? 'INFO',
          httpMethod: payload.ctx?.httpMethod ?? null,
          route: payload.ctx?.route ?? null,
          requestId: payload.ctx?.requestId ?? null,
          sessionId: payload.ctx?.sessionId ?? null,
          ipAddress: payload.ctx?.ipAddress ?? null,
          userAgent: payload.ctx?.userAgent ?? null,
          changes: cleanChanges,
          metadata: cleanMetadata,
        };

        const hash = createHash('sha256')
          .update(prevHash)
          .update('|')
          .update(canonicalJson(corePayload))
          .digest('hex');

        await tx.auditLog.create({
          data: {
            ...corePayload,
            changes: cleanChanges as never,
            metadata: cleanMetadata as never,
            prevHash,
            hash,
          },
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to write audit log for ${payload.action} ${payload.entityType}:${payload.entityId} — ${message}`,
      );
    }
  }

  logAuth(args: {
    action: AuditAuthAction;
    userId?: string | null;
    actorEmail?: string | null;
    status?: AuditStatus;
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
    ctx?: AuditRequestContext;
  }): Promise<void> {
    return this.log({
      eventCategory: 'AUTH',
      action: args.action,
      entityType: 'User',
      entityId: args.userId ?? args.actorEmail ?? 'anonymous',
      userId: args.userId ?? null,
      actorEmail: args.actorEmail ?? null,
      status: args.status,
      severity: args.severity,
      metadata: args.metadata,
      ctx: args.ctx,
    });
  }

  logRbac(args: {
    action: AuditRbacAction;
    userId: string;
    targetUserId: string;
    before?: unknown;
    after?: unknown;
    impersonatedById?: string;
    ctx?: AuditRequestContext;
  }): Promise<void> {
    return this.log({
      eventCategory: 'RBAC',
      action: args.action,
      entityType: 'User',
      entityId: args.targetUserId,
      userId: args.userId,
      impersonatedById: args.impersonatedById ?? null,
      severity: 'WARN',
      changes: { before: args.before, after: args.after },
      ctx: args.ctx,
    });
  }

  logDataChange(args: {
    action: AuditDataAction;
    userId?: string | null;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ctx?: AuditRequestContext;
  }): Promise<void> {
    return this.log({
      eventCategory: 'DATA',
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      userId: args.userId ?? null,
      changes: { before: args.before, after: args.after },
      ctx: args.ctx,
    });
  }

  logSystem(args: {
    action: AuditSystemAction;
    userId?: string | null;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    severity?: AuditSeverity;
    ctx?: AuditRequestContext;
  }): Promise<void> {
    return this.log({
      eventCategory: 'SYSTEM',
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      userId: args.userId ?? null,
      severity: args.severity ?? 'WARN',
      changes: { before: args.before, after: args.after },
      ctx: args.ctx,
    });
  }

  async findAll(opts: {
    page: number;
    limit: number;
    entityType?: string;
    action?: string;
    userId?: string;
    eventCategory?: string;
    status?: string;
    severity?: string;
  }) {
    const where = {
      ...(opts.entityType ? { entityType: opts.entityType } : {}),
      ...(opts.action ? { action: opts.action } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.eventCategory ? { eventCategory: opts.eventCategory } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.severity ? { severity: opts.severity } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: {
          user: { select: { firstName: true, lastName: true, staffId: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: opts.page, limit: opts.limit };
  }

  // Walks the hash chain in createdAt order and validates each row's stored
  // hash against the canonical recomputation. Returns the first row where the
  // chain breaks, or `valid:true` if intact.
  async verifyChain(opts?: { limit?: number }): Promise<{
    valid: boolean;
    inspected: number;
    brokenAt?: { id: string; reason: string };
  }> {
    const take = opts?.limit ?? 5000;
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      take,
    });

    let prevHash = 'genesis';
    let inspected = 0;

    for (const row of rows) {
      inspected += 1;
      if ((row.prevHash ?? 'genesis') !== prevHash) {
        return {
          valid: false,
          inspected,
          brokenAt: { id: row.id, reason: 'prevHash does not match prior row' },
        };
      }
      const expectedPayload = {
        eventCategory: row.eventCategory,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        userId: row.userId,
        actorEmail: row.actorEmail,
        actorType: row.actorType,
        impersonatedById: row.impersonatedById,
        status: row.status,
        severity: row.severity,
        httpMethod: row.httpMethod,
        route: row.route,
        requestId: row.requestId,
        sessionId: row.sessionId,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        changes: row.changes,
        metadata: row.metadata,
      };
      const expected = createHash('sha256')
        .update(prevHash)
        .update('|')
        .update(canonicalJson(expectedPayload))
        .digest('hex');
      if (expected !== row.hash) {
        return {
          valid: false,
          inspected,
          brokenAt: { id: row.id, reason: 'hash mismatch — row mutated' },
        };
      }
      prevHash = row.hash;
    }

    return { valid: true, inspected };
  }
}
