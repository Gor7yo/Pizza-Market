import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, QUEUES } from '../queue/queues';
import { type EmailJob, SENSITIVE_TEMPLATES } from './email.types';

/** Enqueues transactional e-mails; delivery happens in EmailProcessor with retries. */
@Injectable()
export class EmailService {
  constructor(@InjectQueue(QUEUES.email) private readonly queue: Queue<EmailJob>) {}

  /**
   * @param dedupeKey makes the job idempotent: the same key is never enqueued twice
   *                  while a job with that id is still retained.
   */
  async send(job: EmailJob, dedupeKey?: string): Promise<void> {
    const sensitive = SENSITIVE_TEMPLATES.has(job.template);
    await this.queue.add(job.template, job, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: dedupeKey,
      // never keep secrets (codes, reset links) in Redis longer than needed
      ...(sensitive ? { removeOnComplete: true, removeOnFail: { age: 3600 } } : {}),
    });
  }
}
