export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  CSV_IMPORT: 'csv-import',
  REPORT_GENERATION: 'report-generation',
  PAYROLL: 'payroll',
  FEE_REMINDERS: 'fee-reminders',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
