import { Worker, WorkerOptions, Job } from 'bullmq';
import { createRedisClient } from '../redis';

export interface BaseWorkerConfig<TData, TResult> {
  queueName: string;
  concurrency?: number;
  processor: (job: Job<TData, TResult>) => Promise<TResult>;
}

export class BaseRevenueWorker<TData = unknown, TResult = unknown> {
  private worker: Worker<TData, TResult>;
  public queueName: string;

  constructor(config: BaseWorkerConfig<TData, TResult>) {
    this.queueName = config.queueName;

    const workerOptions: WorkerOptions = {
      connection: createRedisClient(),
      concurrency: config.concurrency ?? 5,
      lockDuration: 30000,
    };

    this.worker = new Worker<TData, TResult>(
      config.queueName,
      async (job: Job<TData, TResult>) => {
        const startTime = Date.now();
        console.log(`[Worker][${this.queueName}] Iniciando job ${job.id} (tentativa ${job.attemptsMade + 1})`);

        try {
          const result = await config.processor(job);
          const durationMs = Date.now() - startTime;
          console.log(`[Worker][${this.queueName}] Concluído job ${job.id} com sucesso em ${durationMs}ms`);
          return result;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[Worker][${this.queueName}] Falha no job ${job.id}:`, errorMessage);
          throw err;
        }
      },
      workerOptions
    );

    this.setupListeners();
  }

  private setupListeners(): void {
    this.worker.on('failed', (job, err) => {
      console.warn(`[Worker Alert][${this.queueName}] Job ${job?.id} falhou definitivamente: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      console.error(`[Worker Error][${this.queueName}]`, err.message);
    });
  }

  public async close(): Promise<void> {
    console.log(`[Worker][${this.queueName}] Encerrando worker graciosamente...`);
    await this.worker.close();
  }
}
