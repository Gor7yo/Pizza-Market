import type { JobsOptions } from 'bullmq';

export const QUEUES = {
  email: 'email',
  maintenance: 'maintenance',
} as const;

/** Retry with exponential backoff; keep history for observability without unbounded growth. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 1_000, age: 7 * 24 * 3600 },
  removeOnFail: { count: 5_000, age: 30 * 24 * 3600 },
};
