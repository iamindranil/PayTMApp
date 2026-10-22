import { Queue, QueueOptions, JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const P2P_QUEUE_NAME = "p2p-transfer-queue";

export interface P2PRetryJobData {
  transferId: number;
  fromUserId: string;
  toUserId: number;
  amount: number;
}

export const redisConnectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

export function getRedisClient(): IORedis {
  return new IORedis(redisConnectionOptions);
}

let p2pQueueInstance: Queue<P2PRetryJobData> | null = null;

export function getP2PQueue(): Queue<P2PRetryJobData> {
  if (!p2pQueueInstance) {
    p2pQueueInstance = new Queue<P2PRetryJobData>(P2P_QUEUE_NAME, {
      connection: redisConnectionOptions,
    });
  }
  return p2pQueueInstance;
}

/**
 * Enqueues a failed or transient P2P transfer for asynchronous retries.
 * Uses an idempotent jobId so multiple failure calls will never duplicate jobs.
 */
export async function addP2PRetryJob(
  data: P2PRetryJobData,
  initialDelayMs: number = 60000
) {
  const queue = getP2PQueue();

  const options: JobsOptions = {
    jobId: `p2p-retry-${data.transferId}`, // Idempotent key
    attempts: 3, // Max 3 retry attempts
    backoff: {
      type: "exponential", // Exponential backoff: 1 min, 2 min, 4 min
      delay: initialDelayMs,
    },
    removeOnComplete: {
      age: 3600, // Keep completed job history for 1 hour
      count: 1000,
    },
    removeOnFail: false, // Keep in Dead Letter Queue (DLQ) for audit/inspection
  };

  return queue.add("retry-p2p-transfer", data, options);
}

export * from "bullmq";
