-- AlterTable
ALTER TABLE "p2pTransfer" ADD COLUMN     "lastTriedAt" TIMESTAMP(3),
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
