import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppService, type HealthReport } from './app.service';
import { Public } from './common/auth/decorators';

@ApiTags('system')
@Public()
@SkipThrottle()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async health(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await this.appService.health();
    if (report.status !== 'ok') res.status(503);
    return report;
  }
}
