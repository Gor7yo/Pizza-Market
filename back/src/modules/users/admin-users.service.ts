import { Injectable } from '@nestjs/common';
import type { AdminUserDto, adminUpdateUserSchema, adminUserListQuerySchema } from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';

function toAdminUserDto(u: User & { _count: { orders: number } }): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerifiedAt !== null,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    isBlocked: u.isBlocked,
    orderCount: u._count.orders,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: z.output<typeof adminUserListQuerySchema>) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      OR: query.q
        ? [
            { email: { contains: query.q, mode: 'insensitive' } },
            { firstName: { contains: query.q, mode: 'insensitive' } },
            { lastName: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q } },
          ]
        : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { orders: true } } },
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(rows.map(toAdminUserDto), total, query.page, query.pageSize);
  }

  async update(
    id: string,
    input: z.output<typeof adminUpdateUserSchema>,
    actorId: string,
    client: ClientInfo,
  ): Promise<AdminUserDto> {
    if (id === actorId) {
      throw AppException.badRequest(
        'BAD_REQUEST',
        'You cannot change your own role or block yourself',
      );
    }
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw AppException.notFound('User');

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { role: input.role, isBlocked: input.isBlocked },
        include: { _count: { select: { orders: true } } },
      });
      await this.audit.log(
        {
          actorId,
          action: 'user.update',
          entityType: 'User',
          entityId: id,
          metadata: {
            email: before.email,
            role: input.role !== undefined ? { from: before.role, to: input.role } : undefined,
            isBlocked:
              input.isBlocked !== undefined
                ? { from: before.isBlocked, to: input.isBlocked }
                : undefined,
          },
          client,
        },
        tx,
      );
      return user;
    });

    // Role and block state are embedded in sessions/access tokens: force re-authentication.
    if (before.role !== updated.role || before.isBlocked !== updated.isBlocked) {
      await this.sessions.revokeAllForUser(id);
    }
    return toAdminUserDto(updated);
  }
}
