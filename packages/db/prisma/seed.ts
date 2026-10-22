import { PrismaClient, EntryDirection, JournalEventType, LedgerAccountType } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  getOrCreateSystemAccount,
  getOrCreateUserAccount,
  getOrCreateMerchantAccount,
  postJournalEntry,
} from "../ledger";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing entire database (including ledger)...");

  // Delete in reverse relation order to avoid foreign key constraints
  await prisma.ledgerEntry.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.ledgerAccount.deleteMany({});
  await prisma.p2pTransfer.deleteMany({});
  await prisma.merchantTransaction.deleteMany({});
  await prisma.onRampTransaction.deleteMany({});
  await prisma.balance.deleteMany({});
  await prisma.merchantBalance.deleteMany({});
  await prisma.merchant.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Database cleared successfully. Seeding requested entries with Double-Entry Ledger...");

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

  // 3. Provision Ledger Accounts
  const bankEscrowAccountId = await getOrCreateSystemAccount(prisma, "BANK_ESCROW");
  const user123AccountId = await getOrCreateUserAccount(prisma, user123.id);
  const user456AccountId = await getOrCreateUserAccount(prisma, user456.id);
  const merchant123AccountId = await getOrCreateMerchantAccount(prisma, merchant123.id);
  const merchant456AccountId = await getOrCreateMerchantAccount(prisma, merchant456.id);

  // 4. Record Initial Balanced Capitalization Journal Entry
  // Total initial money = ₹2,000 (200,000 paise).
  // Debit: Bank Escrow (Asset) = +200,000
  // Credit: 4 Accounts x 50,000 (Liabilities) = +200,000
  // Total Debits (200,000) === Total Credits (200,000)
  await postJournalEntry(prisma, {
    referenceId: "seed_initial_capitalization",
    eventType: JournalEventType.ONRAMP_DEPOSIT,
    description: "Initial platform capitalization and seed wallet funding",
    entries: [
      {
        accountId: bankEscrowAccountId,
        direction: EntryDirection.DEBIT,
        amount: 200000, // ₹2,000.00 in Bank Escrow
      },
      {
        accountId: user123AccountId,
        direction: EntryDirection.CREDIT,
        amount: 50000, // ₹500.00 to User 123
      },
      {
        accountId: user456AccountId,
        direction: EntryDirection.CREDIT,
        amount: 50000, // ₹500.00 to User 456
      },
      {
        accountId: merchant123AccountId,
        direction: EntryDirection.CREDIT,
        amount: 50000, // ₹500.00 to Merchant 123
      },
      {
        accountId: merchant456AccountId,
        direction: EntryDirection.CREDIT,
        amount: 50000, // ₹500.00 to Merchant 456
      },
    ],
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
  console.log("Double-Entry Ledger initialized and 100% balanced.");
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