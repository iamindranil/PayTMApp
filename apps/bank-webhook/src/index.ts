import "dotenv/config";
import express from "express";
import db, {
  getOrCreateSystemAccount,
  getOrCreateUserAccount,
  getOrCreateMerchantAccount,
  postJournalEntry,
} from "@repo/db/client";
import { EntryDirection, JournalEventType } from "@prisma/client";
import {
  verifyWebhookSignature,
  DEFAULT_WEBHOOK_SECRET,
} from "./security";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export const app = express();

// Preserve exact raw byte buffer for cryptographic HMAC-SHA256 verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET;

app.post("/hdfcWebhook", async (req, res) => {
  // 1. Cryptographic HMAC-SHA256 Signature Verification
  const signatureHeader =
    req.headers["x-webhook-signature"] || req.headers["x-signature"];
  const verification = verifyWebhookSignature(
    req.rawBody,
    signatureHeader,
    WEBHOOK_SECRET
  );

  if (!verification.isValid) {
    res.status(verification.statusCode || 401).json({
      message: verification.error || "Unauthorized webhook request",
    });
    return;
  }

  // 2. Validate payload structure
  const paymentInformation: { token: string; userId: string; amount: string } = {
    token: req.body?.token,
    userId: req.body?.user_identifier,
    amount: req.body?.amount,
  };

  const userId = Number(paymentInformation.userId);
  const amount = Number(paymentInformation.amount);

  if (!paymentInformation.token || !userId || !amount || amount <= 0) {
    res.status(400).json({
      message: "Invalid webhook payload",
    });
    return;
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 3. Strict Idempotency Check: Look up onRampTransaction by token
      const existingTx = await tx.onRampTransaction.findUnique({
        where: {
          token: paymentInformation.token,
        },
      });

      if (!existingTx) {
        return { status: 404, message: "Transaction token not found" };
      }

      // Idempotency: If already settled, acknowledge safely without double-crediting
      if (existingTx.status === "Success") {
        return {
          status: 200,
          message: "Transaction already processed",
          idempotent: true,
        };
      }

      if (existingTx.status === "Failure") {
        return { status: 400, message: "Cannot capture failed transaction" };
      }

      // Security Check: Verify user and amount match initiated deposit record
      if (existingTx.userId !== userId || existingTx.amount !== amount) {
        return {
          status: 400,
          message: "Payload user or amount does not match transaction record",
        };
      }

      // 4. Double-Entry Ledger: Money arrives from partner bank into escrow
      // Debit: Bank Escrow (Asset +)
      // Credit: User Wallet (Liability +)
      const bankEscrowId = await getOrCreateSystemAccount(tx, "BANK_ESCROW");
      const userAccountId = await getOrCreateUserAccount(tx, userId);

      await postJournalEntry(tx, {
        referenceId: `onramp_${paymentInformation.token}`,
        eventType: JournalEventType.ONRAMP_DEPOSIT,
        description: `HDFC Bank deposit for User #${userId}`,
        entries: [
          {
            accountId: bankEscrowId,
            direction: EntryDirection.DEBIT,
            amount,
          },
          {
            accountId: userAccountId,
            direction: EntryDirection.CREDIT,
            amount,
          },
        ],
      });

      // 5. Update fast-read cached balances
      await tx.balance.upsert({
        where: { userId },
        update: {
          amount: {
            increment: amount,
          },
        },
        create: {
          userId,
          amount,
          locked: 0,
        },
      });

      // 6. Mark OnRamp transaction as Success
      await tx.onRampTransaction.update({
        where: {
          token: paymentInformation.token,
        },
        data: {
          status: "Success",
        },
      });

      return { status: 200, message: "captured", idempotent: false };
    });

    res.status(result.status).json({
      message: result.message,
      ...(result.idempotent ? { idempotent: true } : {}),
    });
  } catch (e) {
    console.error("Webhook processing error:", e);
    res.status(500).json({
      message: "Error while processing webhook",
    });
  }
});

app.post("/payWithQR", async (req, res) => {
  const paymentInfo: {
    userId: string;
    merchantId: string;
    amount: string;
    createdAt: string;
  } = {
    userId: req.body.userId,
    merchantId: req.body.merchantId,
    amount: req.body.amount,
    createdAt: req.body.createdAt,
  };

  const userId = Number(paymentInfo.userId);
  const merchantId = Number(paymentInfo.merchantId);
  const amount = Number(paymentInfo.amount);
  const createdAt = new Date(paymentInfo.createdAt);

  if (!userId || !merchantId || !amount || isNaN(createdAt.getTime()) || amount <= 0) {
    res.status(400).json({
      message: "Invalid Input",
    });
    return;
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. Check user balance
      const userBalance = await tx.balance.findUnique({
        where: { userId },
      });

      if (!userBalance || userBalance.amount < amount) {
        throw new Error("Insufficient user balance");
      }

      // 2. Double-Entry Ledger: User pays Merchant
      // Debit: User Wallet (Liability -)
      // Credit: Merchant Wallet (Liability +)
      const userAccountId = await getOrCreateUserAccount(tx, userId);
      const merchantAccountId = await getOrCreateMerchantAccount(tx, merchantId);

      const qrRef = `qr_${userId}_${merchantId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await postJournalEntry(tx, {
        referenceId: qrRef,
        eventType: JournalEventType.MERCHANT_PAYMENT,
        description: `QR Code settlement from User #${userId} to Merchant #${merchantId}`,
        entries: [
          {
            accountId: userAccountId,
            direction: EntryDirection.DEBIT,
            amount,
          },
          {
            accountId: merchantAccountId,
            direction: EntryDirection.CREDIT,
            amount,
          },
        ],
      });

      // 3. Update fast-read cached balances
      await tx.balance.update({
        where: { userId },
        data: {
          amount: {
            decrement: amount,
          },
        },
      });

      await tx.merchantBalance.upsert({
        where: { merchantId },
        update: {
          amount: {
            increment: amount,
          },
        },
        create: {
          merchantId,
          amount,
          locked: 0,
        },
      });

      // 4. Update MerchantTransaction status
      const matchingTxns = await tx.merchantTransaction.findMany({
        where: {
          merchantId,
          payerId: userId,
          amount,
        },
      });

      if (matchingTxns.length === 1) {
        await tx.merchantTransaction.update({
          where: {
            id: matchingTxns[0]?.id,
          },
          data: {
            status: "Success",
          },
        });
      } else if (matchingTxns.length > 1) {
        const tnxToUpdate = matchingTxns.find(
          (t) => t.createdAt.getTime() === createdAt.getTime()
        );
        if (tnxToUpdate) {
          await tx.merchantTransaction.update({
            where: {
              id: tnxToUpdate.id,
            },
            data: {
              status: "Success",
            },
          });
        }
      }
    });

    res.status(200).json({ message: "Payment successful via QR" });
  } catch (err) {
    console.error("QR payment error:", err);
    res.status(400).json({
      message: "Error while paying money Via QR",
    });
  }
});

const PORT = process.env.PORT || 3003;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Bank webhook microservice listening on port ${PORT}`);
  });
}
