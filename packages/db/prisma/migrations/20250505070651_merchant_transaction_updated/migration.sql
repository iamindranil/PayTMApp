-- DropForeignKey
ALTER TABLE "MerchantTransaction" DROP CONSTRAINT "MerchantTransaction_payerId_fkey";

-- AlterTable
ALTER TABLE "MerchantTransaction" ALTER COLUMN "payerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MerchantTransaction" ADD CONSTRAINT "MerchantTransaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
