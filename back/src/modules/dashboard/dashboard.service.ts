import { Injectable } from '@nestjs/common';
import type { DashboardStatsDto } from '@market/shared';
import { asLocalized } from '../../common/utils/json';
import { AppConfig } from '../../config/app-config.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toCustomer } from '../orders/admin-orders.service';
import { toOrderSummary } from '../orders/orders.mapper';

interface DayRow {
  day: string;
  revenue: bigint | number | null;
  orders: bigint | number;
}

/** Every metric is computed from real orders; cancelled orders never count as revenue. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async stats(days: number): Promise<DashboardStatsDto> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const tz = this.config.get('STORE_TIMEZONE');
    const counted: Prisma.OrderWhereInput = {
      createdAt: { gte: since },
      status: { not: 'CANCELLED' },
    };

    const [revenueAgg, cancelledOrders, newCustomers, byDay, popular, recent, byStatus] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: counted,
          _sum: { total: true },
          _count: { _all: true },
        }),
        this.prisma.order.count({ where: { createdAt: { gte: since }, status: 'CANCELLED' } }),
        this.prisma.user.count({ where: { createdAt: { gte: since }, role: 'USER' } }),
        this.prisma.$queryRaw<DayRow[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS day,
               SUM("total")::bigint AS revenue,
               COUNT(*)::bigint AS orders
        FROM "Order"
        WHERE "createdAt" >= ${since} AND "status" <> 'CANCELLED'
        GROUP BY 1
        ORDER BY 1`),
        this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: { productId: { not: null }, order: counted },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            items: { select: { quantity: true } },
            payment: { select: { status: true } },
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        }),
      ]);

    const revenue = revenueAgg._sum.total ?? 0;
    const orders = revenueAgg._count._all;

    const products = await this.prisma.product.findMany({
      where: { id: { in: popular.flatMap((p) => (p.productId ? [p.productId] : [])) } },
      select: { id: true, name: true },
    });
    const names = new Map(products.map((p) => [p.id, asLocalized(p.name)]));

    return {
      currency: this.config.get('STORE_CURRENCY'),
      periodDays: days,
      revenue,
      orders,
      newCustomers,
      averageOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
      cancelledOrders,
      salesByDay: this.fillDays(byDay, days, tz),
      popularProducts: popular.map((p) => ({
        productId: p.productId ?? '',
        name: names.get(p.productId ?? '') ?? {},
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.lineTotal ?? 0,
      })),
      recentOrders: recent.map((o) => ({
        ...toOrderSummary(o),
        customer: toCustomer(o.user),
        contactPhone: o.contactPhone,
      })),
      ordersByStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    };
  }

  /** Returns one entry per calendar day (store time zone), zeros included. */
  private fillDays(rows: DayRow[], days: number, tz: string): DashboardStatsDto['salesByDay'] {
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const result: DashboardStatsDto['salesByDay'] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = fmt.format(new Date(Date.now() - i * 24 * 3600 * 1000));
      const row = byDay.get(date);
      result.push({ date, revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) });
    }
    return result;
  }
}
