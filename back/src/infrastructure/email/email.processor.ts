import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '../queue/queues';
import { EmailProvider } from './email.provider';
import { renderEmail } from './email.templates';
import type { EmailJob } from './email.types';

@Processor(QUEUES.email, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly provider: EmailProvider) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    await this.provider.send(renderEmail(job.data));
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJob>): void {
    // Never log the payload: it may contain codes or reset links.
    this.logger.log(`E-mail "${job.data.template}" sent (job ${job.id})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJob> | undefined, error: Error): void {
    this.logger.warn(
      `E-mail "${job?.data.template}" failed (job ${job?.id}, attempt ${job?.attemptsMade}): ${error.message}`,
    );
  }
}
