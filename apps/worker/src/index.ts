import 'dotenv/config';

import { Worker, type ConnectionOptions } from 'bullmq';

import { logger } from './logger';
import { processNotification } from './processors/notifications.processor';
import { QUEUE_NAMES } from './queues';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
  };
}

async function bootstrap() {
  logger.info('Starting School ERP Worker');

  const connection = parseRedisConnection(REDIS_URL);

  const workerOptions = {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
  };

  // Notifications worker
  const notificationsWorker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotification,
    workerOptions,
  );

  // CSV Import worker (placeholder — processor implemented in import module)
  const csvImportWorker = new Worker(
    QUEUE_NAMES.CSV_IMPORT,
    async (job) => {
      logger.info('Processing CSV import job', { jobId: job.id, data: job.data });
    },
    workerOptions,
  );

  // Report generation worker (placeholder)
  const reportWorker = new Worker(
    QUEUE_NAMES.REPORT_GENERATION,
    async (job) => {
      logger.info('Processing report generation job', { jobId: job.id });
    },
    workerOptions,
  );

  // Payroll worker (placeholder)
  const payrollWorker = new Worker(
    QUEUE_NAMES.PAYROLL,
    async (job) => {
      logger.info('Processing payroll job', { jobId: job.id });
    },
    workerOptions,
  );

  // Fee reminders worker (placeholder)
  const feeRemindersWorker = new Worker(
    QUEUE_NAMES.FEE_REMINDERS,
    async (job) => {
      logger.info('Processing fee reminder job', { jobId: job.id });
    },
    workerOptions,
  );

  const workers = [
    notificationsWorker,
    csvImportWorker,
    reportWorker,
    payrollWorker,
    feeRemindersWorker,
  ];

  // Event handlers
  workers.forEach((worker) => {
    worker.on('completed', (job) => {
      logger.info('Job completed', { queue: worker.name, jobId: job.id });
    });

    worker.on('failed', (job, err) => {
      logger.error('Job failed', {
        queue: worker.name,
        jobId: job?.id,
        error: err.message,
        stack: err.stack,
      });
    });

    worker.on('error', (err) => {
      logger.error('Worker error', { queue: worker.name, error: err.message });
    });
  });

  logger.info('All workers started successfully', {
    queues: Object.values(QUEUE_NAMES),
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down workers gracefully…`);
    await Promise.all(workers.map((w) => w.close()));
    logger.info('All workers stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Worker bootstrap failed', { error: err });
  process.exit(1);
});
