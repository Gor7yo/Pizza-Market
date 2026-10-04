import { Injectable } from '@nestjs/common';
import {
  type AdminOrderDetailDto,
  type adminOrderListQuerySchema,
  type AdminOrderSummaryDto,
  getAllowedTransitions,
  type Paginated,
} from '@market/shared';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app.exception';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { orderDetailInclude, toOrderDetail, toOrderSummary } from './orders.mapper';

export function toCustomer(u: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null) {
  return u
    ? { id: u.id, email: u.email, name: [u.firstName, u.lastName].filter(Boolean).join(' ') }
    : null;
}

const customerSelect = {
  select: { id: true, email: true, firstName: true, lastName: true },
} as const;

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
  ) {}

  async list(
    query: z.output<typeof adminOrderListQuerySchema>,
  ): Promise<Paginated<AdminOrderSummaryDto>> {
    const q = query.q?.trim();
    const number = q && /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : undefined;
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
      OR: q
        ? [
            ...(number !== undefined && Number.isSafeInteger(number) ? [{ number }] : []),
            { contactPhone: { contains: q.replace(/[\s()-]/g, '') } },
            { contactName: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { select: { quantity: true } },
          payment: { select: { status: true } },
          user: customerSelect,
        },
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(
      rows.map((o) => ({
        ...toOrderSummary(o),
        customer: toCustomer(o.user),
        contactPhone: o.contactPhone,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async get(id: string): Promise<AdminOrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { ...orderDetailInclude, user: customerSelect },
    });
    if (!order) throw AppException.notFound('Order');
    return {
      ...toOrderDetail(order, this.storage),
      customer: toCustomer(order.user),
      allowedTransitions: getAllowedTransitions(order.status, order.fulfillment),
    };
  }
}
