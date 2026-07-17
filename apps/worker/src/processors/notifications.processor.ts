import { Job } from 'bullmq';

import { logger } from '../logger';

export interface NotificationJobData {
  tenantId: string;
  userId: string;
  type: 'email' | 'sms' | 'whatsapp' | 'push';
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { tenantId, userId, type, recipient } = job.data;
  logger.info('Processing notification job', {
    jobId: job.id,
    tenantId,
    userId,
    type,
    recipient,
  });

  try {
    // Notification dispatching logic will be implemented in the communications module
    switch (type) {
      case 'email':
        logger.info('Dispatching email notification', { recipient });
        break;
      case 'sms':
        logger.info('Dispatching SMS notification', { recipient });
        break;
      case 'whatsapp':
        logger.info('Dispatching WhatsApp notification', { recipient });
        break;
      case 'push':
        logger.info('Dispatching push notification', { recipient });
        break;
      default:
        logger.warn('Unknown notification type', { type });
    }
  } catch (error) {
    logger.error('Failed to process notification', { jobId: job.id, error });
    throw error;
  }
}
