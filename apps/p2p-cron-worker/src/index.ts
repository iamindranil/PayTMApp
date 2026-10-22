import express from "express";
import db from "@repo/db/client";
import { Worker, Job } from "bullmq";
import {
  P2P_QUEUE_NAME,
  P2PRetryJobData,
  redisConnectionOptions,
  getP2PQueue,
} from "@repo/queue";
import { transferMoney } from "../../user-app/app/lib/moneyTransfer/transfer";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const app = express();
app.use(express.json());

// ==========================================
// 1. BULL-BOARD DASHBOARD SETUP (Port 4000)
// ==========================================
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

const p2pQueue = getP2PQueue();

createBullBoard({
  queues: [new BullMQAdapter(p2pQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.get("/health", async (req, res) => {
  const counts = await p2pQueue.getJobCounts();
  res.json({
    status: "healthy",
    service: "p2p-distributed-worker",
    queue: P2P_QUEUE_NAME,
    metrics: counts,
  });
});

// ==========================================
// 2. BULLMQ DISTRIBUTED WORKER
// ==========================================
const worker = new Worker<P2PRetryJobData>(
  P2P_QUEUE_NAME,
  async (job: Job<P2PRetryJobData>) => {
    const { transferId, fromUserId, toUserId, amount } = job.data;
    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 3;

    console.log(
      `[Worker] 🚀 Processing retry for Transfer #${transferId} (Attempt ${currentAttempt}/${maxAttempts})...`
    );

    // Execute money transfer inside ACID transaction with row-locking and Double-Entry Ledger
    await transferMoney(
      fromUserId,
      toUserId,
      amount,
      `p2p_retry_${transferId}_att_${currentAttempt}`
    );

    // Update transfer status to 'Success' in PostgreSQL
    await db.p2pTransfer.update({
      where: { id: transferId },
      data: {
        status: "Success",
        retryCount: currentAttempt,
        lastTriedAt: new Date(),
        nextRetryAt: null,
      },
    });

    console.log(`[Worker] ✅ Transfer #${transferId} settled successfully!`);
    return { transferId, status: "Success", attempt: currentAttempt };
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5, // Process up to 5 jobs simultaneously
  }
);

// Event: Completed
worker.on("completed", (job: Job<P2PRetryJobData>) => {
  console.log(`[Worker] Job #${job.id} (Transfer #${job.data.transferId}) completed.`);
});

// Event: Failed (Dead Letter Queue Handling)
worker.on("failed", async (job: Job<P2PRetryJobData> | undefined, err: Error) => {
  if (!job) return;

  const maxAttempts = job.opts.attempts || 3;
  console.warn(
    `[Worker] ⚠️ Job #${job.id} (Transfer #${job.data.transferId}) failed on attempt ${job.attemptsMade}/${maxAttempts}: ${err.message}`
  );

  if (job.attemptsMade >= maxAttempts) {
    console.error(
      `[Worker] ❌ Transfer #${job.data.transferId} permanently exhausted all ${maxAttempts} retries. Moving to Dead Letter Queue (DLQ).`
    );

    await db.p2pTransfer.update({
      where: { id: job.data.transferId },
      data: {
        status: "Failure",
        retryCount: job.attemptsMade,
        lastTriedAt: new Date(),
        nextRetryAt: null,
      },
    });
  } else {
    // Record retry progress in DB
    await db.p2pTransfer.update({
      where: { id: job.data.transferId },
      data: {
        retryCount: job.attemptsMade,
        lastTriedAt: new Date(),
      },
    });
  }
});

// ==========================================
// 3. START SERVER & GRACEFUL SHUTDOWN
// ==========================================
const PORT = 4000;
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ⚡ BullMQ P2P Worker listening on port ${PORT}`);
  console.log(`  📊 Bull-Board Dashboard: http://localhost:${PORT}/admin/queues`);
  console.log(`  🏥 Health & Metrics:     http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully stopping worker and closing queues...`);
  await worker.close();
  await p2pQueue.close();
  server.close(() => {
    console.log("Worker process stopped cleanly.");
    process.exit(0);
  });
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
