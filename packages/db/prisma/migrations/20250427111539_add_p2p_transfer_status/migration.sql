-- CreateEnum
CREATE TYPE "P2PStatus" AS ENUM ('Success', 'Failure', 'Processing');

-- AlterTable
ALTER TABLE "p2pTransfer" ADD COLUMN     "status" "P2PStatus" NOT NULL DEFAULT 'Processing';
