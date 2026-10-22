"use server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth"
import prisma from "@repo/db/client";
import { transferMoney } from "../moneyTransfer/transfer";

import { addP2PRetryJob } from "@repo/queue";

export async function p2pTransfer(to: string, amount: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user?.id) {
    return {
      message: "Unauthorized request/Error while Sending",
    };
  }
  const fromUserId = session.user.id;
  const toUser = await prisma.user.findFirst({
    where: {
      number: to,
    },
  });
  if (!toUser) {
    return {
      message: "User not found",
    };
  }
  const toUserId = toUser.id;

  try {
    await transferMoney(fromUserId, toUserId, amount);
    await prisma.p2pTransfer.create({
      data: {
        fromUserId: Number(fromUserId),
        toUserId: toUserId,
        amount: amount,
        timestamp: new Date(),
        status: "Success",
      },
    });
    return { message: "Transfer successful" };
  } catch (err) {
    console.error("Transaction failed, delegating to BullMQ retry queue:", err);

    // 1. Record pending transfer in database
    const pendingTransfer = await prisma.p2pTransfer.create({
      data: {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
        amount: amount,
        timestamp: new Date(),
        status: "Processing",
        nextRetryAt: new Date(Date.now() + 60000),
      },
    });

    // 2. Dispatch to BullMQ distributed queue (with exponential backoff)
    try {
      await addP2PRetryJob({
        transferId: pendingTransfer.id,
        fromUserId: String(fromUserId),
        toUserId: Number(toUserId),
        amount: amount,
      });
    } catch (queueErr) {
      console.error("Failed to enqueue retry job to BullMQ:", queueErr);
    }

    return {
      message: "Transfer is currently processing and has been queued for automatic retry.",
    };
  }
}