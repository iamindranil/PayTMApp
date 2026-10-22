import prisma from "@repo/db/client";
import {
  getOrCreateUserAccount,
  postJournalEntry,
} from "@repo/db/client";
import { EntryDirection, JournalEventType } from "@prisma/client";

export async function transferMoney(
  fromUserId: string,
  toUserId: number,
  amount: number,
  referenceId?: string
) {
  const ref = referenceId || `p2p_${fromUserId}_${toUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await prisma.$transaction(async (tx) => {
    // 1. Pessimistic row-level locking on sender's balance snapshot
    await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(fromUserId)} FOR UPDATE`;

    const fromBalance = await tx.balance.findUnique({
      where: {
        userId: Number(fromUserId),
      },
    });

    if (!fromBalance || fromBalance.amount < amount) {
      throw new Error("Insufficient balance");
    }

    // 2. Ensure ledger accounts exist for both parties
    const fromAccountId = await getOrCreateUserAccount(tx, Number(fromUserId));
    const toAccountId = await getOrCreateUserAccount(tx, Number(toUserId));

    // 3. Post immutable, balanced double-entry journal transaction
    // Strictly enforces Sum(Debits) === Sum(Credits)
    await postJournalEntry(tx, {
      referenceId: ref,
      eventType: JournalEventType.P2P_TRANSFER,
      description: `P2P transfer from User #${fromUserId} to User #${toUserId}`,
      entries: [
        {
          accountId: fromAccountId,
          direction: EntryDirection.DEBIT,
          amount,
        },
        {
          accountId: toAccountId,
          direction: EntryDirection.CREDIT,
          amount,
        },
      ],
    });

    // 4. Update materialized fast-read balance caches
    await tx.balance.update({
      where: {
        userId: Number(fromUserId),
      },
      data: {
        amount: {
          decrement: amount,
        },
      },
    });

    await tx.balance.upsert({
      where: {
        userId: Number(toUserId),
      },
      update: {
        amount: {
          increment: amount,
        },
      },
      create: {
        userId: Number(toUserId),
        amount,
        locked: 0,
      },
    });
  });
}