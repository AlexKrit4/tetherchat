import { Queue, Worker } from 'bullmq';
import { getConfig } from '../config.js';
import { createRedis } from '../redis.js';
import { attachPreviews } from '../services/linkPreviewService.js';
import { sendPushToUsers } from '../services/pushService.js';
import { sendMail } from '../services/mailService.js';
import { expireRingingCall } from '../services/callService.js';
import type { PushPayload } from '../services/pushService.js';

export const QUEUE_NAME = 'tetherchat';

export type JobPayload =
  | { type: 'link-preview'; messageId: string; urls: string[] }
  | { type: 'push'; userIds: string[]; payload: PushPayload }
  | { type: 'email'; to: string; subject: string; text: string; html?: string }
  | { type: 'call-timeout'; callId: string };

export interface EnqueueOptions {
  delay?: number;
}

let queue: Queue<JobPayload> | null = null;
let worker: Worker<JobPayload> | null = null;

export async function runJob(job: JobPayload): Promise<void> {
  switch (job.type) {
    case 'link-preview':
      await attachPreviews(job.messageId, job.urls);
      return;
    case 'push':
      await sendPushToUsers(job.userIds, job.payload);
      return;
    case 'email':
      await sendMail(job.to, job.subject, job.text, job.html);
      return;
    case 'call-timeout':
      await expireRingingCall(job.callId);
      return;
  }
}

/**
 * Background work is queued through Redis in normal operation. When workers are
 * disabled (tests, one-off scripts) the job runs inline and failures are swallowed
 * so they never break the request that scheduled them.
 */
export async function enqueue(job: JobPayload, options: EnqueueOptions = {}): Promise<void> {
  if (!getConfig().ENABLE_WORKERS) {
    if (options.delay) {
      setTimeout(() => {
        void runJob(job).catch(() => undefined);
      }, options.delay);
      return;
    }
    void runJob(job).catch(() => undefined);
    return;
  }

  queue ??= new Queue<JobPayload>(QUEUE_NAME, {
    connection: createRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });

  await queue.add(job.type, job, { delay: options.delay }).catch(() => {
    if (options.delay) {
      setTimeout(() => {
        void runJob(job).catch(() => undefined);
      }, options.delay);
      return;
    }
    void runJob(job).catch(() => undefined);
  });
}

export function startWorkers(): void {
  if (!getConfig().ENABLE_WORKERS || worker) return;

  worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job) => {
      await runJob(job.data);
    },
    { connection: createRedis(), concurrency: 5 },
  );

  worker.on('failed', (job, error) => {
    console.error(`[jobs] ${job?.name ?? 'unknown'} failed:`, error.message);
  });
}

export async function stopWorkers(): Promise<void> {
  await worker?.close().catch(() => undefined);
  await queue?.close().catch(() => undefined);
  worker = null;
  queue = null;
}
