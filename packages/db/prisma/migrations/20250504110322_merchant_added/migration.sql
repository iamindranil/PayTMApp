/*
  Warnings:

  - Added the required column `userId` to the `Merchant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('Success', 'Failure', 'Processing');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "MerchantTransaction" (
    "id" SERIAL NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "reference" TEXT NOT NULL,
    "payerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantTransaction_reference_key" ON "MerchantTransaction"("reference");

-- AddForeignKey
ALTER TABLE "MerchantTransaction" ADD CONSTRAINT "MerchantTransaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantTransaction" ADD CONSTRAINT "MerchantTransaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
