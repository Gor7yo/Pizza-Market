import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { dashboardQuerySchema, type DashboardStatsDto } from '@market/shared';
import type { z } from 'zod';
import { AdminOnly } from '../../common/auth/decorators';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('admin')
@AdminOnly()
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  stats(
    @ZodQuery(dashboardQuerySchema) query: z.output<typeof dashboardQuerySchema>,
  ): Promise<DashboardStatsDto> {
    return this.dashboard.stats(query.days);
  }
}
