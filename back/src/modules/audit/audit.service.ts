import { Injectable, Logger } from '@nestjs/common';
import type { AuditLogDto, auditLogQuerySchema } from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const SENSITIVE_KEY = /(password|token|secret|hash|code|cookie|authorization)/i;

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  client?: ClientInfo;
}

/** Removes anything that looks like a credential before it is persisted. */
export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value))
    return value.slice(0, 50).map((v) => sanitizeAuditMetadata(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : sanitizeAuditMetadata(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Computes {field: {from, to}} for changed scalar/JSON fields. */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Pass `tx` to make the audit record part of the same transaction as the change. */
  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? this.prisma;
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: (sanitizeAuditMetadata(entry.metadata ?? {}) ?? {}) as Prisma.InputJsonValue,
        ip: entry.client?.ip ?? null,
        userAgent: entry.client?.userAgent ?? null,
      },
    });
    this.logger.debug(`audit ${entry.action} ${entry.entityType}:${entry.entityId ?? '-'}`);
  }

  async list(query: z.output<typeof auditLogQuerySchema>) {
    const { page, pageSize } = query;
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType || undefined,
      action: query.action ? { contains: query.action, mode: 'insensitive' } : undefined,
      actorId: query.actorId || undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, email: true } } },
        ...pageArgs(page, pageSize),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items: AuditLogDto[] = rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));
    return paginated(items, total, page, pageSize);
  }
}
