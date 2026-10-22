import { getP2PQueue, addP2PRetryJob, P2P_QUEUE_NAME, getRedisClient } from "@repo/queue";
import prisma from "../index";

async function main() {
  console.log("================================================================================");
  console.log("                 BULLMQ & REDIS DISTRIBUTED QUEUE VERIFICATION                  ");
  console.log("================================================================================");

  // 1. Test Redis Connection
  const redis = getRedisClient();
  const ping = await redis.ping();
  console.log(`1. Redis Connection (localhost:6379): ${ping === "PONG" ? "✅ ONLINE (PONG)" : "❌ FAILED"}`);

  // 2. Access Queue
  const queue = getP2PQueue();
  console.log(`2. BullMQ Queue: "${P2P_QUEUE_NAME}" initialized successfully.`);

  // 3. Inspect existing job counts
  let counts = await queue.getJobCounts();
  console.log("3. Current Queue Telemetry:", counts);

  // 4. Dispatch a simulated retry job
  console.log("\n4. Simulating a transient failure & enqueuing P2P retry job...");
  const dummyTransfer = await prisma.p2pTransfer.create({
    data: {
      fromUserId: 15,
      toUserId: 16,
      amount: 1000, // ₹10.00
      status: "Processing",
      timestamp: new Date(),
      nextRetryAt: new Date(Date.now() + 5000),
    },
  });

  const job = await addP2PRetryJob(
    {
      transferId: dummyTransfer.id,
      fromUserId: "15",
      toUserId: 16,
      amount: 1000,
    },
    2000 // 2 second delay for instant testing
  );

  console.log(`   ✅ Job enqueued successfully!`);
  console.log(`      Job ID     : ${job.id}`);
  console.log(`      Transfer ID: ${dummyTransfer.id}`);
  console.log(`      Delay      : 2,000ms`);
  console.log(`      Max Retries: ${job.opts.attempts}`);

  // 5. Check queue state after enqueue
  counts = await queue.getJobCounts();
  console.log("\n5. Updated Queue Telemetry:", counts);
  console.log(`   Delayed Jobs: ${counts.delayed} (waiting for delay to expire)`);

  console.log("\n================================================================================");
  console.log("  To view the visual dashboard in your browser:");
  console.log("  👉 http://localhost:4000/admin/queues");
  console.log("================================================================================");

  await queue.close();
  redis.disconnect();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
