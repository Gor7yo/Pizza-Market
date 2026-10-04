import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QUEUES } from '../../infrastructure/queue/queues';

const CLEANUP_JOB = 'cleanup-expired-auth-data';
const RETENTION_DAYS = 30;

/**
 * Daily cleanup of expired sessions, codes and reset tokens.
 * Idempotent (pure deletes by date) and scheduled once per cluster via a job scheduler.
 */
@Processor(QUEUES.maintenance)
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.maintenance) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      CLEANUP_JOB,
      { pattern: '0 3 * * *' },
      { name: CLEANUP_JOB, opts: { removeOnComplete: 30, removeOnFail: 100 } },
    );
  }

  async process(job: Job): Promise<Record<string, number>> {
    if (job.name !== CLEANUP_JOB) return {};
    const now = new Date();
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000);
    const [sessions, codes, resets] = await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: cutoff } }] },
      }),
      this.prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    return { sessions: sessions.count, codes: codes.count, resets: resets.count };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: Record<string, number>): void {
    this.logger.log(`Maintenance job ${job.name} done: ${JSON.stringify(result)}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Maintenance job ${job?.name} failed: ${error.message}`);
  }
}
