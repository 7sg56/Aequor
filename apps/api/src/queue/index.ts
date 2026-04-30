/**
 * BullMQ-based job queue for agent task processing.
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('queue');

// ── Redis connection ─────────────────────────────────────────────────────────

const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

// ── Queue definitions ────────────────────────────────────────────────────────

export const verificationQueue = new Queue('verification', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const paymentQueue = new Queue('payment', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export const notificationQueue = new Queue('notification', {
  connection,
});

// ── Job types ────────────────────────────────────────────────────────────────

export interface VerificationJobData {
  taskId: string;
  submissionId: string;
  repoUrl: string;
  branch: string;
  specs: Record<string, unknown>;
}

export interface PaymentJobData {
  taskId: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  streamRate?: number;
}

export interface NotificationJobData {
  type: 'task_update' | 'payment_update' | 'dispute_update';
  taskId: string;
  payload: Record<string, unknown>;
}

// ── Worker creation helper ───────────────────────────────────────────────────

export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 3,
): Worker<T> {
  const worker = new Worker<T>(queueName, processor, {
    connection,
    concurrency,
  });

  worker.on('completed', (job) => {
    log.info(`Job completed: ${queueName}/${job.id}`);
  });

  worker.on('failed', (job, err) => {
    log.error(`Job failed: ${queueName}/${job?.id}`, {
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  return worker;
}

// ── Convenience enqueue functions ────────────────────────────────────────────

export async function enqueueVerification(data: VerificationJobData): Promise<string> {
  const job = await verificationQueue.add('verify-work', data, {
    priority: 1,
  });
  log.info('Verification job enqueued', { jobId: job.id, taskId: data.taskId });
  return job.id!;
}

export async function enqueuePayment(data: PaymentJobData): Promise<string> {
  const job = await paymentQueue.add('process-payment', data, {
    priority: 2,
  });
  log.info('Payment job enqueued', { jobId: job.id, taskId: data.taskId });
  return job.id!;
}
