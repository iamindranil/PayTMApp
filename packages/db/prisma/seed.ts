import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing entire database...");

  // Delete in reverse relation order to avoid foreign key constraints
  await prisma.p2pTransfer.deleteMany({});
  await prisma.merchantTransaction.deleteMany({});
  await prisma.onRampTransaction.deleteMany({});
  await prisma.balance.deleteMany({});
  await prisma.merchantBalance.deleteMany({});
  await prisma.merchant.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Database cleared successfully. Seeding requested entries...");

  const hash123 = await bcrypt.hash("123", 10);
  const hash456 = await bcrypt.hash("456", 10);

  // 1. Seed Entry 1: ID-123 (as User and Merchant)
  const user123 = await prisma.user.create({
    data: {
      number: "123",
      name: "User 123",
      email: "user123@turbopay.com",
      password: hash123,
      Balance: {
        create: {
          amount: 50000, // ₹500.00
          locked: 0,
        },
      },
    },
  });

  const merchant123 = await prisma.merchant.create({
    data: {
      number: "123",
      name: "Merchant 123",
      email: "merchant123@turbopay.com",
      password: hash123,
      userId: user123.id,
      MerchantBalance: {
        create: {
          amount: 50000, // ₹500.00
          locked: 0,
        },
      },
    },
  });

  // 2. Seed Entry 2: ID-456 (as User and Merchant)
  const user456 = await prisma.user.create({
    data: {
      number: "456",
      name: "User 456",
      email: "user456@turbopay.com",
      password: hash456,
      Balance: {
        create: {
          amount: 50000, // ₹500.00
          locked: 0,
        },
      },
    },
  });

  const merchant456 = await prisma.merchant.create({
    data: {
      number: "456",
      name: "Merchant 456",
      email: "merchant456@turbopay.com",
      password: hash456,
      userId: user456.id,
      MerchantBalance: {
        create: {
          amount: 50000, // ₹500.00
          locked: 0,
        },
      },
    },
  });

  console.log("Seeding complete! Available entries:");
  console.log("-----------------------------------------");
  console.log("Entry 1:");
  console.log("  Phone / Business ID : 123");
  console.log("  Password            : 123");
  console.log("  User ID             :", user123.id);
  console.log("  Merchant ID         :", merchant123.id);
  console.log("-----------------------------------------");
  console.log("Entry 2:");
  console.log("  Phone / Business ID : 456");
  console.log("  Password            : 456");
  console.log("  User ID             :", user456.id);
  console.log("  Merchant ID         :", merchant456.id);
  console.log("-----------------------------------------");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error during database reset/seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });