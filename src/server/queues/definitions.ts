import { Queue, QueueOptions } from 'bullmq';
import { getRedisConnection } from '../redis';

export const QUEUE_NAMES = {
  SCRAPING: 'revenue-os:scraping-queue',
  ENRICHMENT: 'revenue-os:enrichment-queue',
  CADENCE_DISPATCHER: 'revenue-os:cadence-dispatcher-queue',
  CRM_SYNC: 'revenue-os:crm-sync-queue',
} as const;

export interface ScrapingJobData {
  workspaceId: string;
  executionId: string;
  actorId: string;
  inputConfig: Record<string, unknown>;
  estimatedCredits: number;
}

export interface EnrichmentJobData {
  workspaceId: string;
  executionId: string;
  apifyRunId: string;
  actualCostUsd: number;
}

export interface CadenceDispatcherJobData {
  workspaceId: string;
  taskId: string;
  enrollmentId: string;
  mailboxId: string;
}

export interface CrmSyncJobData {
  workspaceId: string;
  entityType: 'contact' | 'deal';
  entityId: string;
  triggerEvent: string;
}

const defaultQueueOptions: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 500,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 1000,
      age: 7 * 24 * 3600,
    },
  },
};

export const scrapingQueue = new Queue<ScrapingJobData>(QUEUE_NAMES.SCRAPING, defaultQueueOptions);
export const enrichmentQueue = new Queue<EnrichmentJobData>(QUEUE_NAMES.ENRICHMENT, defaultQueueOptions);
export const cadenceDispatcherQueue = new Queue<CadenceDispatcherJobData>(QUEUE_NAMES.CADENCE_DISPATCHER, defaultQueueOptions);
export const crmSyncQueue = new Queue<CrmSyncJobData>(QUEUE_NAMES.CRM_SYNC, defaultQueueOptions);
