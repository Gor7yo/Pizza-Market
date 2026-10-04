import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../infrastructure/queue/queues';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.maintenance })],
  providers: [MaintenanceProcessor],
})
export class MaintenanceModule {}
