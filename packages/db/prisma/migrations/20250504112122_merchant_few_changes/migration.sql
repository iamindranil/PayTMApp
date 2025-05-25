/*
  Warnings:

  - A unique constraint covering the columns `[number]` on the table `Merchant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `number` to the `Merchant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Merchant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "number" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_number_key" ON "Merchant"("number");
