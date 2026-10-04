import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditLogQuerySchema } from '@market/shared';
import type { z } from 'zod';
import { AdminOnly } from '../../common/auth/decorators';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { AuditService } from './audit.service';

@ApiTags('admin')
@AdminOnly()
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@ZodQuery(auditLogQuerySchema) query: z.output<typeof auditLogQuerySchema>) {
    return this.audit.list(query);
  }
}
