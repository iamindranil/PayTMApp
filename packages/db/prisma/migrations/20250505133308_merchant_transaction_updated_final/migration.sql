/*
  Warnings:

  - You are about to drop the column `reference` on the `MerchantTransaction` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "MerchantTransaction_reference_key";

-- AlterTable
ALTER TABLE "MerchantTransaction" DROP COLUMN "reference";
